-- =====================================================================
-- BuildFlow V1 — initial schema
-- Multi-tenant: every CRM / project row carries business_id and is
-- protected by Row Level Security keyed on business membership.
-- =====================================================================

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
create type public.account_type as enum ('customer', 'contractor');
create type public.member_role as enum ('owner', 'member');
create type public.lead_status as enum ('new', 'contacted', 'qualified', 'quote_sent', 'negotiation', 'won', 'lost');
create type public.lead_source as enum ('buildflow', 'website', 'referral', 'social_media', 'phone', 'other');
create type public.customer_status as enum ('active', 'inactive', 'past');
create type public.project_status as enum ('planning', 'upcoming', 'in_progress', 'on_hold', 'completed', 'cancelled');
create type public.task_status as enum ('todo', 'in_progress', 'done');
create type public.task_priority as enum ('low', 'medium', 'high');
create type public.post_type as enum ('completed_project', 'before_after', 'work_in_progress', 'project_update', 'service_showcase', 'business_update');
create type public.subscription_status as enum ('trialing', 'active', 'past_due', 'canceled', 'incomplete');
create type public.report_target as enum ('post', 'comment', 'business');
create type public.report_reason as enum ('spam', 'fraud', 'harassment', 'inappropriate', 'fake_business', 'other');
create type public.report_status as enum ('open', 'reviewing', 'actioned', 'dismissed');
create type public.location_level as enum ('country', 'region', 'city');

-- ---------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  avatar_url text,
  account_type public.account_type not null default 'customer',
  is_platform_admin boolean not null default false,
  is_suspended boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- Reference data: locations (country -> region/parish/state -> city/area)
-- ---------------------------------------------------------------------
create table public.locations (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.locations (id) on delete cascade,
  country_code char(2) not null,
  level public.location_level not null,
  name text not null,
  slug text not null,
  region_label text, -- e.g. 'Parish', 'State', 'Province' (on country rows)
  unique (country_code, level, slug)
);
create index locations_parent_idx on public.locations (parent_id);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  plural_name text not null,
  is_active boolean not null default true,
  sort_order int not null default 100
);

-- ---------------------------------------------------------------------
-- Businesses (the tenant) + public contractor profile fields
-- ---------------------------------------------------------------------
create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete restrict,
  name text not null check (char_length(name) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  tagline text,
  description text,
  phone text,
  email text,
  website text,
  social_links jsonb not null default '{}'::jsonb,
  years_in_business int check (years_in_business between 0 and 200),
  logo_url text,
  cover_url text,
  country_code char(2) not null default 'JM',
  region_id uuid references public.locations (id) on delete set null,
  city text,
  service_area text,
  primary_service_id uuid references public.services (id) on delete set null,
  is_public boolean not null default true,
  is_verified boolean not null default false,
  is_suspended boolean not null default false,
  is_demo boolean not null default false,
  onboarding_step int not null default 0,
  onboarding_completed_at timestamptz,
  follower_count int not null default 0,
  post_count int not null default 0,
  completed_project_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index businesses_owner_idx on public.businesses (owner_id);
create index businesses_region_idx on public.businesses (region_id);
create index businesses_name_trgm on public.businesses using gin (name gin_trgm_ops);
create trigger businesses_touch before update on public.businesses for each row execute function public.touch_updated_at();

create table public.business_members (
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.member_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (business_id, user_id)
);
create index business_members_user_idx on public.business_members (user_id);

create table public.business_invitations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  email text not null,
  role public.member_role not null default 'member',
  token uuid not null default gen_random_uuid() unique,
  invited_by uuid references public.profiles (id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (business_id, email)
);

create table public.business_services (
  business_id uuid not null references public.businesses (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete cascade,
  primary key (business_id, service_id)
);
create index business_services_service_idx on public.business_services (service_id);

-- ---------------------------------------------------------------------
-- Membership helpers (SECURITY DEFINER so RLS policies can call them
-- without recursive policy evaluation on business_members)
-- ---------------------------------------------------------------------
create or replace function public.is_business_member(bid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.business_members m
    join public.profiles p on p.id = m.user_id
    where m.business_id = bid and m.user_id = auth.uid() and not p.is_suspended
  );
$$;

create or replace function public.is_business_owner(bid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.business_members m
    where m.business_id = bid and m.user_id = auth.uid() and m.role = 'owner'
  );
$$;

create or replace function public.is_platform_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_platform_admin from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.is_business_visible(bid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.businesses b where b.id = bid and b.is_public and not b.is_suspended);
$$;

-- ---------------------------------------------------------------------
-- Subscriptions (plan catalogue is data, not code)
-- ---------------------------------------------------------------------
create table public.subscription_plans (
  id text primary key,                      -- 'basic', later 'pro', 'business', 'enterprise'
  name text not null,
  description text,
  currency char(3) not null default 'USD',
  billing_interval text not null default 'month' check (billing_interval in ('month', 'year')),
  base_price_cents int not null check (base_price_cents >= 0),
  included_seats int not null default 1 check (included_seats >= 1),
  additional_seat_price_cents int not null default 0 check (additional_seat_price_cents >= 0),
  max_seats int,
  features jsonb not null default '[]'::jsonb,
  stripe_price_id text,
  stripe_seat_price_id text,
  is_active boolean not null default true,
  is_public boolean not null default true,
  sort_order int not null default 100,
  created_at timestamptz not null default now()
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null unique references public.businesses (id) on delete cascade,
  plan_id text not null references public.subscription_plans (id),
  status public.subscription_status not null default 'trialing',
  seats int not null default 1 check (seats >= 1),
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  stripe_customer_id text,
  stripe_subscription_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger subscriptions_touch before update on public.subscriptions for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- CRM
-- ---------------------------------------------------------------------
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  phone text,
  email text,
  address text,
  city text,
  notes text,
  status public.customer_status not null default 'active',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index customers_business_idx on public.customers (business_id, created_at desc);
create index customers_name_trgm on public.customers using gin (name gin_trgm_ops);
create trigger customers_touch before update on public.customers for each row execute function public.touch_updated_at();

create table public.quote_requests (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  requester_id uuid references public.profiles (id) on delete set null,
  name text not null,
  email text,
  phone text,
  service_id uuid references public.services (id) on delete set null,
  location text,
  description text not null,
  budget_range text,
  timeline text,
  kind text not null default 'quote' check (kind in ('quote', 'contact')),
  created_at timestamptz not null default now()
);
create index quote_requests_business_idx on public.quote_requests (business_id, created_at desc);
create index quote_requests_requester_idx on public.quote_requests (requester_id, created_at desc);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  phone text,
  email text,
  location text,
  description text,
  service_id uuid references public.services (id) on delete set null,
  status public.lead_status not null default 'new',
  source public.lead_source not null default 'other',
  estimated_value numeric(12, 2) check (estimated_value >= 0),
  assigned_to uuid references public.profiles (id) on delete set null,
  customer_id uuid references public.customers (id) on delete set null,
  quote_request_id uuid references public.quote_requests (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  status_changed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index leads_business_status_idx on public.leads (business_id, status, created_at desc);
create index leads_customer_idx on public.leads (customer_id);
create trigger leads_touch before update on public.leads for each row execute function public.touch_updated_at();

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete set null,
  lead_id uuid references public.leads (id) on delete set null,
  name text not null check (char_length(name) between 1 and 160),
  description text,
  location text,
  start_date date,
  expected_end_date date,
  completed_at timestamptz,
  status public.project_status not null default 'planning',
  budget numeric(12, 2) check (budget >= 0),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projects_business_status_idx on public.projects (business_id, status, created_at desc);
create index projects_customer_idx on public.projects (customer_id);
create trigger projects_touch before update on public.projects for each row execute function public.touch_updated_at();

create table public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);
create index project_members_user_idx on public.project_members (user_id);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  description text,
  assigned_to uuid references public.profiles (id) on delete set null,
  due_date date,
  priority public.task_priority not null default 'medium',
  status public.task_status not null default 'todo',
  completed_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tasks_project_idx on public.tasks (project_id, status);
create index tasks_business_due_idx on public.tasks (business_id, due_date) where status <> 'done';
create index tasks_assignee_idx on public.tasks (assigned_to) where status <> 'done';
create trigger tasks_touch before update on public.tasks for each row execute function public.touch_updated_at();

create table public.project_photos (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  url text not null,
  caption text,
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index project_photos_project_idx on public.project_photos (project_id, created_at desc);

-- Notes are shared by leads, customers and projects.
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  entity_type text not null check (entity_type in ('lead', 'customer', 'project')),
  entity_id uuid not null,
  body text not null check (char_length(body) between 1 and 5000),
  author_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index notes_entity_idx on public.notes (business_id, entity_type, entity_id, created_at desc);

create table public.activity_logs (
  id bigint generated always as identity primary key,
  business_id uuid not null references public.businesses (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index activity_logs_business_idx on public.activity_logs (business_id, created_at desc);
create index activity_logs_entity_idx on public.activity_logs (entity_type, entity_id, created_at desc);

-- ---------------------------------------------------------------------
-- Social
-- ---------------------------------------------------------------------
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  type public.post_type not null default 'completed_project',
  caption text check (char_length(caption) <= 2200),
  project_id uuid references public.projects (id) on delete set null,
  service_id uuid references public.services (id) on delete set null,
  location_text text,
  is_public boolean not null default true,
  is_hidden boolean not null default false, -- moderation
  like_count int not null default 0,
  comment_count int not null default 0,
  save_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index posts_feed_idx on public.posts (created_at desc) where is_public and not is_hidden;
create index posts_business_idx on public.posts (business_id, created_at desc);
create index posts_service_idx on public.posts (service_id, created_at desc);
create trigger posts_touch before update on public.posts for each row execute function public.touch_updated_at();

create table public.post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  url text not null,
  label text check (label in ('before', 'after')),
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index post_media_post_idx on public.post_media (post_id, position);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  is_hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index comments_post_idx on public.comments (post_id, created_at);

create table public.likes (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index likes_user_idx on public.likes (user_id);

create table public.saves (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index saves_user_idx on public.saves (user_id, created_at desc);

create table public.follows (
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (business_id, user_id)
);
create index follows_user_idx on public.follows (user_id);

-- ---------------------------------------------------------------------
-- Notifications, analytics, moderation
-- ---------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  business_id uuid references public.businesses (id) on delete cascade,
  type text not null check (type in ('quote_request', 'new_lead', 'comment', 'follower', 'project_assigned', 'task_assigned', 'system')),
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  emailed_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;

create table public.analytics_events (
  id bigint generated always as identity primary key,
  business_id uuid not null references public.businesses (id) on delete cascade,
  event_type text not null check (event_type in ('profile_view', 'post_view', 'like', 'comment', 'follow', 'save', 'quote_request', 'contact_click', 'lead_created', 'project_won', 'project_completed')),
  post_id uuid references public.posts (id) on delete set null,
  actor_id uuid references public.profiles (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index analytics_events_business_idx on public.analytics_events (business_id, event_type, created_at desc);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles (id) on delete set null,
  target_type public.report_target not null,
  target_id uuid not null,
  reason public.report_reason not null,
  details text check (char_length(details) <= 1000),
  status public.report_status not null default 'open',
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (reporter_id, target_type, target_id)
);
create index reports_status_idx on public.reports (status, created_at desc);

-- =====================================================================
-- Triggers: integrity & side effects
-- =====================================================================

-- New auth user -> profile row.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, account_type)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    case when new.raw_user_meta_data ->> 'account_type' = 'contractor' then 'contractor'::public.account_type
         else 'customer'::public.account_type end
  )
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Users cannot grant themselves admin / unsuspend themselves.
create or replace function public.protect_profile_flags() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_platform_admin() then
    new.is_platform_admin := old.is_platform_admin;
    new.is_suspended := old.is_suspended;
  end if;
  return new;
end $$;
create trigger profiles_protect before update on public.profiles for each row execute function public.protect_profile_flags();

-- New business -> owner membership + Basic trial subscription.
create or replace function public.handle_new_business() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  default_plan text;
begin
  insert into public.business_members (business_id, user_id, role) values (new.id, new.owner_id, 'owner')
  on conflict do nothing;
  update public.profiles set account_type = 'contractor' where id = new.owner_id;
  select id into default_plan from public.subscription_plans where is_active order by sort_order limit 1;
  if default_plan is not null then
    insert into public.subscriptions (business_id, plan_id, status, seats, trial_ends_at)
    values (new.id, default_plan, 'trialing', 1, now() + interval '14 days')
    on conflict (business_id) do nothing;
  end if;
  return new;
end $$;
create trigger businesses_after_insert after insert on public.businesses for each row execute function public.handle_new_business();

-- Business owners cannot self-verify, un-suspend, or transfer ownership by direct update.
create or replace function public.protect_business_flags() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- pg_trigger_depth() > 1 means this update comes from one of our own
  -- counter triggers, not directly from a client.
  if auth.uid() is not null and not public.is_platform_admin() and pg_trigger_depth() <= 1 then
    new.is_verified := old.is_verified;
    new.is_suspended := old.is_suspended;
    new.is_demo := old.is_demo;
    new.owner_id := old.owner_id;
    new.follower_count := old.follower_count;
    new.post_count := old.post_count;
    new.completed_project_count := old.completed_project_count;
  end if;
  return new;
end $$;
create trigger businesses_protect before update on public.businesses for each row execute function public.protect_business_flags();

-- Every tenant-scoped child row must reference parents in the SAME business.
create or replace function public.enforce_same_business() returns trigger
language plpgsql security definer set search_path = public as $$
-- NB: each branch only touches columns that exist on its table; plpgsql
-- does not short-circuit field access on NEW across tables.
begin
  if tg_table_name in ('leads', 'projects') then
    if new.customer_id is not null then
      if not exists (select 1 from public.customers where id = new.customer_id and business_id = new.business_id) then
        raise exception 'customer belongs to a different business';
      end if;
    end if;
  end if;
  if tg_table_name in ('tasks', 'project_photos', 'project_members') then
    if not exists (select 1 from public.projects where id = new.project_id and business_id = new.business_id) then
      raise exception 'project belongs to a different business';
    end if;
  end if;
  if tg_table_name = 'posts' then
    if new.project_id is not null then
      if not exists (select 1 from public.projects where id = new.project_id and business_id = new.business_id) then
        raise exception 'project belongs to a different business';
      end if;
    end if;
  end if;
  if tg_table_name = 'post_media' then
    if not exists (select 1 from public.posts where id = new.post_id and business_id = new.business_id) then
      raise exception 'post belongs to a different business';
    end if;
  end if;
  if tg_table_name in ('leads', 'tasks') then
    if new.assigned_to is not null then
      if not exists (select 1 from public.business_members where business_id = new.business_id and user_id = new.assigned_to) then
        raise exception 'assignee is not a member of this business';
      end if;
    end if;
  end if;
  if tg_table_name = 'project_members' then
    if not exists (select 1 from public.business_members where business_id = new.business_id and user_id = new.user_id) then
      raise exception 'user is not a member of this business';
    end if;
  end if;
  return new;
end $$;
create trigger leads_same_business before insert or update on public.leads for each row execute function public.enforce_same_business();
create trigger projects_same_business before insert or update on public.projects for each row execute function public.enforce_same_business();
create trigger tasks_same_business before insert or update on public.tasks for each row execute function public.enforce_same_business();
create trigger project_photos_same_business before insert or update on public.project_photos for each row execute function public.enforce_same_business();
create trigger project_members_same_business before insert or update on public.project_members for each row execute function public.enforce_same_business();
create trigger posts_same_business before insert or update on public.posts for each row execute function public.enforce_same_business();
create trigger post_media_same_business before insert or update on public.post_media for each row execute function public.enforce_same_business();

-- Lead status bookkeeping + "won" analytics.
create or replace function public.handle_lead_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.analytics_events (business_id, event_type, metadata)
    values (new.business_id, 'lead_created', jsonb_build_object('source', new.source));
    return new;
  end if;
  if new.status is distinct from old.status then
    new.status_changed_at := now();
    if new.status = 'won' then
      insert into public.analytics_events (business_id, event_type, metadata)
      values (new.business_id, 'project_won', jsonb_build_object('lead_id', new.id));
    end if;
  end if;
  if new.assigned_to is distinct from old.assigned_to and new.assigned_to is not null and new.assigned_to <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000') then
    insert into public.notifications (user_id, business_id, type, title, link)
    values (new.assigned_to, new.business_id, 'new_lead', 'A lead was assigned to you: ' || new.name, '/app/leads/' || new.id);
  end if;
  return new;
end $$;
create trigger leads_before_update before update on public.leads for each row execute function public.handle_lead_change();
create trigger leads_after_insert after insert on public.leads for each row execute function public.handle_lead_change();

-- Project completion bookkeeping.
create or replace function public.handle_project_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'completed' and (tg_op = 'INSERT' or old.status is distinct from 'completed') then
    new.completed_at := coalesce(new.completed_at, now());
    insert into public.analytics_events (business_id, event_type, metadata)
    values (new.business_id, 'project_completed', jsonb_build_object('project_id', new.id));
  elsif new.status <> 'completed' then
    new.completed_at := null;
  end if;
  return new;
end $$;
create trigger projects_status before insert or update of status on public.projects for each row execute function public.handle_project_change();

create or replace function public.refresh_completed_count() returns trigger
language plpgsql security definer set search_path = public as $$
declare bid uuid := coalesce(new.business_id, old.business_id);
begin
  update public.businesses
     set completed_project_count = (select count(*) from public.projects where business_id = bid and status = 'completed')
   where id = bid;
  return null;
end $$;
create trigger projects_completed_count after insert or update of status or delete on public.projects for each row execute function public.refresh_completed_count();

-- Task completion timestamp + assignment notification.
create or replace function public.handle_task_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'done' and (tg_op = 'INSERT' or old.status <> 'done') then
    new.completed_at := now();
  elsif new.status <> 'done' then
    new.completed_at := null;
  end if;
  if new.assigned_to is not null
     and (tg_op = 'INSERT' or new.assigned_to is distinct from old.assigned_to)
     and new.assigned_to <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000') then
    insert into public.notifications (user_id, business_id, type, title, link)
    values (new.assigned_to, new.business_id, 'task_assigned', 'New task: ' || new.title, '/app/projects/' || new.project_id);
  end if;
  return new;
end $$;
create trigger tasks_change before insert or update on public.tasks for each row execute function public.handle_task_change();

create or replace function public.handle_project_member_added() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.user_id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000') then
    insert into public.notifications (user_id, business_id, type, title, link)
    select new.user_id, new.business_id, 'project_assigned', 'You were added to ' || p.name, '/app/projects/' || p.id
      from public.projects p where p.id = new.project_id;
  end if;
  return new;
end $$;
create trigger project_members_notify after insert on public.project_members for each row execute function public.handle_project_member_added();

-- Seats follow team size so billing = base + (members - included) * seat price.
create or replace function public.sync_subscription_seats() returns trigger
language plpgsql security definer set search_path = public as $$
declare bid uuid := coalesce(new.business_id, old.business_id);
begin
  update public.subscriptions
     set seats = greatest(1, (select count(*) from public.business_members where business_id = bid))
   where business_id = bid;
  return null;
end $$;
create trigger business_members_seats after insert or delete on public.business_members for each row execute function public.sync_subscription_seats();

-- Notes are polymorphic, so clean them up when their parent is deleted.
create or replace function public.delete_entity_notes() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.notes where business_id = old.business_id and entity_id = old.id
    and entity_type = case tg_table_name when 'leads' then 'lead' when 'customers' then 'customer' else 'project' end;
  return null;
end $$;
create trigger leads_delete_notes after delete on public.leads for each row execute function public.delete_entity_notes();
create trigger customers_delete_notes after delete on public.customers for each row execute function public.delete_entity_notes();
create trigger projects_delete_notes after delete on public.projects for each row execute function public.delete_entity_notes();

-- Social counters, analytics and notifications.
create or replace function public.handle_like() returns trigger
language plpgsql security definer set search_path = public as $$
declare bid uuid;
begin
  if tg_op = 'INSERT' then
    update public.posts set like_count = like_count + 1 where id = new.post_id returning business_id into bid;
    insert into public.analytics_events (business_id, event_type, post_id, actor_id) values (bid, 'like', new.post_id, new.user_id);
  else
    update public.posts set like_count = greatest(like_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end $$;
create trigger likes_count after insert or delete on public.likes for each row execute function public.handle_like();

create or replace function public.handle_save() returns trigger
language plpgsql security definer set search_path = public as $$
declare bid uuid;
begin
  if tg_op = 'INSERT' then
    update public.posts set save_count = save_count + 1 where id = new.post_id returning business_id into bid;
    insert into public.analytics_events (business_id, event_type, post_id, actor_id) values (bid, 'save', new.post_id, new.user_id);
  else
    update public.posts set save_count = greatest(save_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end $$;
create trigger saves_count after insert or delete on public.saves for each row execute function public.handle_save();

create or replace function public.handle_comment() returns trigger
language plpgsql security definer set search_path = public as $$
declare bid uuid; commenter text;
begin
  if tg_op = 'INSERT' then
    update public.posts set comment_count = comment_count + 1 where id = new.post_id returning business_id into bid;
    insert into public.analytics_events (business_id, event_type, post_id, actor_id) values (bid, 'comment', new.post_id, new.user_id);
    select coalesce(nullif(full_name, ''), 'Someone') into commenter from public.profiles where id = new.user_id;
    insert into public.notifications (user_id, business_id, type, title, body, link)
    select m.user_id, bid, 'comment', commenter || ' commented on your post', left(new.body, 140), '/post/' || new.post_id
      from public.business_members m where m.business_id = bid and m.role = 'owner' and m.user_id <> new.user_id;
  else
    update public.posts set comment_count = greatest(comment_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end $$;
create trigger comments_count after insert or delete on public.comments for each row execute function public.handle_comment();

create or replace function public.handle_follow() returns trigger
language plpgsql security definer set search_path = public as $$
declare follower text;
begin
  if tg_op = 'INSERT' then
    update public.businesses set follower_count = follower_count + 1 where id = new.business_id;
    insert into public.analytics_events (business_id, event_type, actor_id) values (new.business_id, 'follow', new.user_id);
    select coalesce(nullif(full_name, ''), 'Someone') into follower from public.profiles where id = new.user_id;
    insert into public.notifications (user_id, business_id, type, title, link)
    select m.user_id, new.business_id, 'follower', follower || ' started following your business', '/app/analytics'
      from public.business_members m where m.business_id = new.business_id and m.role = 'owner' and m.user_id <> new.user_id;
  else
    update public.businesses set follower_count = greatest(follower_count - 1, 0) where id = old.business_id;
  end if;
  return null;
end $$;
create trigger follows_count after insert or delete on public.follows for each row execute function public.handle_follow();

create or replace function public.handle_post_count() returns trigger
language plpgsql security definer set search_path = public as $$
declare bid uuid := coalesce(new.business_id, old.business_id);
begin
  update public.businesses
     set post_count = (select count(*) from public.posts where business_id = bid and is_public and not is_hidden)
   where id = bid;
  return null;
end $$;
create trigger posts_count after insert or update of is_public, is_hidden or delete on public.posts for each row execute function public.handle_post_count();

-- =====================================================================
-- RPCs (the only path for anonymous writes)
-- =====================================================================

-- Quote request / contact: creates quote_request + lead + notification atomically.
create or replace function public.submit_quote_request(
  p_business_id uuid,
  p_name text,
  p_email text,
  p_phone text,
  p_service_id uuid,
  p_location text,
  p_description text,
  p_budget_range text default null,
  p_timeline text default null,
  p_kind text default 'quote'
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  qr_id uuid;
  ld_id uuid;
  recent int;
begin
  if not public.is_business_visible(p_business_id) then
    raise exception 'business not available';
  end if;
  if coalesce(trim(p_name), '') = '' or coalesce(trim(p_description), '') = '' then
    raise exception 'name and description are required';
  end if;
  if coalesce(trim(p_email), '') = '' and coalesce(trim(p_phone), '') = '' then
    raise exception 'an email or phone number is required';
  end if;
  if p_kind not in ('quote', 'contact') then
    raise exception 'invalid kind';
  end if;
  -- Database-level abuse guard: max 5 requests per business per contact per hour.
  select count(*) into recent from public.quote_requests
   where business_id = p_business_id
     and created_at > now() - interval '1 hour'
     and ((p_email is not null and lower(email) = lower(p_email)) or (p_phone is not null and phone = p_phone)
          or (auth.uid() is not null and requester_id = auth.uid()));
  if recent >= 5 then
    raise exception 'too many requests, please try again later';
  end if;

  insert into public.quote_requests (business_id, requester_id, name, email, phone, service_id, location, description, budget_range, timeline, kind)
  values (p_business_id, auth.uid(), left(trim(p_name), 160), nullif(trim(p_email), ''), nullif(trim(p_phone), ''), p_service_id,
          left(p_location, 200), left(p_description, 4000), left(p_budget_range, 100), left(p_timeline, 100), p_kind)
  returning id into qr_id;

  insert into public.leads (business_id, name, email, phone, location, description, service_id, source, quote_request_id)
  values (p_business_id, left(trim(p_name), 160), nullif(trim(p_email), ''), nullif(trim(p_phone), ''), left(p_location, 200),
          concat_ws(E'\n', left(p_description, 4000),
                    case when p_budget_range is not null then 'Budget: ' || p_budget_range end,
                    case when p_timeline is not null then 'Timeline: ' || p_timeline end),
          p_service_id, 'buildflow', qr_id)
  returning id into ld_id;

  insert into public.analytics_events (business_id, event_type, metadata)
  values (p_business_id, case when p_kind = 'quote' then 'quote_request' else 'contact_click' end, jsonb_build_object('lead_id', ld_id));

  insert into public.notifications (user_id, business_id, type, title, body, link)
  select m.user_id, p_business_id, 'quote_request',
         case when p_kind = 'quote' then 'New quote request from ' else 'New message from ' end || left(trim(p_name), 80),
         left(p_description, 140), '/app/leads/' || ld_id
    from public.business_members m where m.business_id = p_business_id and m.role = 'owner';

  insert into public.activity_logs (business_id, actor_id, entity_type, entity_id, action, summary)
  values (p_business_id, auth.uid(), 'lead', ld_id, 'created',
          case when p_kind = 'quote' then 'Quote request received from ' else 'Contact request from ' end || left(trim(p_name), 80));

  return ld_id;
end $$;

-- View tracking (profile_view / post_view only).
create or replace function public.track_view(p_business_id uuid, p_post_id uuid default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_business_visible(p_business_id) then return; end if;
  -- Don't count a business viewing itself.
  if public.is_business_member(p_business_id) then return; end if;
  insert into public.analytics_events (business_id, event_type, post_id, actor_id)
  values (p_business_id, case when p_post_id is null then 'profile_view' else 'post_view' end, p_post_id, auth.uid());
end $$;

-- Lead -> customer conversion (atomic).
create or replace function public.convert_lead_to_customer(p_lead_id uuid) returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  l public.leads;
  cid uuid;
begin
  select * into l from public.leads where id = p_lead_id; -- RLS limits to caller's businesses
  if l.id is null then raise exception 'lead not found'; end if;
  if l.customer_id is not null then return l.customer_id; end if;
  insert into public.customers (business_id, name, phone, email, address, notes, created_by)
  values (l.business_id, l.name, l.phone, l.email, l.location, l.description, auth.uid())
  returning id into cid;
  update public.leads set customer_id = cid, status = case when status in ('won', 'lost') then status else 'won' end where id = l.id;
  insert into public.activity_logs (business_id, actor_id, entity_type, entity_id, action, summary)
  values (l.business_id, auth.uid(), 'customer', cid, 'created', 'Converted lead ' || l.name || ' into a customer');
  return cid;
end $$;

-- Accept a team invitation by token.
create or replace function public.accept_invitation(p_token uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare inv public.business_invitations; user_email text;
begin
  select email into user_email from auth.users where id = auth.uid();
  select * into inv from public.business_invitations where token = p_token and accepted_at is null;
  if inv.id is null then raise exception 'invitation not found'; end if;
  if lower(inv.email) <> lower(user_email) then raise exception 'invitation was sent to a different email'; end if;
  insert into public.business_members (business_id, user_id, role) values (inv.business_id, auth.uid(), inv.role)
  on conflict do nothing;
  update public.business_invitations set accepted_at = now() where id = inv.id;
  update public.profiles set account_type = 'contractor' where id = auth.uid();
  return inv.business_id;
end $$;

-- Public listing of a business's team for assignment pickers (members only).
create or replace function public.business_team(p_business_id uuid)
returns table (user_id uuid, full_name text, avatar_url text, role public.member_role)
language sql stable security definer set search_path = public as $$
  select m.user_id, p.full_name, p.avatar_url, m.role
    from public.business_members m join public.profiles p on p.id = m.user_id
   where m.business_id = p_business_id and public.is_business_member(p_business_id)
   order by m.role, p.full_name;
$$;

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.profiles enable row level security;
alter table public.locations enable row level security;
alter table public.services enable row level security;
alter table public.businesses enable row level security;
alter table public.business_members enable row level security;
alter table public.business_invitations enable row level security;
alter table public.business_services enable row level security;
alter table public.subscription_plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.customers enable row level security;
alter table public.quote_requests enable row level security;
alter table public.leads enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.tasks enable row level security;
alter table public.project_photos enable row level security;
alter table public.notes enable row level security;
alter table public.activity_logs enable row level security;
alter table public.posts enable row level security;
alter table public.post_media enable row level security;
alter table public.comments enable row level security;
alter table public.likes enable row level security;
alter table public.saves enable row level security;
alter table public.follows enable row level security;
alter table public.notifications enable row level security;
alter table public.analytics_events enable row level security;
alter table public.reports enable row level security;

-- Profiles: only display fields are readable; admin flag is exposed via is_platform_admin().
create policy profiles_read on public.profiles for select using (true);
create policy profiles_update_self on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_admin on public.profiles for update using (public.is_platform_admin());
revoke select on public.profiles from anon, authenticated;
grant select (id, full_name, avatar_url, account_type, is_suspended, created_at) on public.profiles to anon, authenticated;

-- Reference data
create policy locations_read on public.locations for select using (true);
create policy locations_admin on public.locations for all using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy services_read on public.services for select using (true);
create policy services_admin on public.services for all using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy plans_read on public.subscription_plans for select using (is_active and is_public or public.is_platform_admin());
create policy plans_admin on public.subscription_plans for all using (public.is_platform_admin()) with check (public.is_platform_admin());

-- Businesses
create policy businesses_public_read on public.businesses for select
  using ((is_public and not is_suspended) or public.is_business_member(id) or public.is_platform_admin());
create policy businesses_insert on public.businesses for insert
  with check (owner_id = auth.uid() and not exists (select 1 from public.business_members where user_id = auth.uid() and role = 'owner'));
create policy businesses_update on public.businesses for update
  using (public.is_business_owner(id) or public.is_platform_admin())
  with check (public.is_business_owner(id) or public.is_platform_admin());

create policy members_read on public.business_members for select
  using (public.is_business_member(business_id) or user_id = auth.uid() or public.is_platform_admin());
create policy members_owner_delete on public.business_members for delete
  using (public.is_business_owner(business_id) and role <> 'owner');

create policy invitations_owner on public.business_invitations for all
  using (public.is_business_owner(business_id)) with check (public.is_business_owner(business_id));

create policy business_services_read on public.business_services for select
  using (public.is_business_visible(business_id) or public.is_business_member(business_id));
create policy business_services_write on public.business_services for all
  using (public.is_business_owner(business_id)) with check (public.is_business_owner(business_id));

-- Subscriptions: members read; writes only by service role (billing webhooks) or admin.
create policy subscriptions_read on public.subscriptions for select
  using (public.is_business_member(business_id) or public.is_platform_admin());
create policy subscriptions_admin on public.subscriptions for update using (public.is_platform_admin());

-- Tenant-private tables: identical member-only policies.
do $$
declare t text;
begin
  foreach t in array array['customers', 'leads', 'projects', 'tasks', 'project_photos', 'notes', 'project_members'] loop
    execute format('create policy %1$s_member_select on public.%1$s for select using (public.is_business_member(business_id))', t);
    execute format('create policy %1$s_member_insert on public.%1$s for insert with check (public.is_business_member(business_id))', t);
    execute format('create policy %1$s_member_update on public.%1$s for update using (public.is_business_member(business_id)) with check (public.is_business_member(business_id))', t);
  end loop;
end $$;
-- Deletes are owner-only (team members cannot destroy records).
create policy customers_owner_delete on public.customers for delete using (public.is_business_owner(business_id));
create policy leads_owner_delete on public.leads for delete using (public.is_business_owner(business_id));
create policy projects_owner_delete on public.projects for delete using (public.is_business_owner(business_id));
create policy tasks_member_delete on public.tasks for delete using (public.is_business_member(business_id));
create policy project_photos_member_delete on public.project_photos for delete using (public.is_business_member(business_id));
create policy notes_author_delete on public.notes for delete using (author_id = auth.uid() or public.is_business_owner(business_id));
create policy project_members_owner_delete on public.project_members for delete using (public.is_business_owner(business_id));

-- Quote requests: inserted only via submit_quote_request(); readable by the business and the requester.
create policy quote_requests_read on public.quote_requests for select
  using (public.is_business_member(business_id) or requester_id = auth.uid());

create policy activity_read on public.activity_logs for select using (public.is_business_member(business_id));
create policy activity_insert on public.activity_logs for insert
  with check (public.is_business_member(business_id) and actor_id = auth.uid());

-- Posts
create policy posts_read on public.posts for select
  using ((is_public and not is_hidden and public.is_business_visible(business_id))
         or public.is_business_member(business_id) or public.is_platform_admin());
create policy posts_insert on public.posts for insert
  with check (public.is_business_member(business_id) and author_id = auth.uid());
create policy posts_update on public.posts for update
  using (public.is_business_owner(business_id) or author_id = auth.uid() or public.is_platform_admin());
create policy posts_delete on public.posts for delete
  using (public.is_business_owner(business_id) or author_id = auth.uid() or public.is_platform_admin());

create policy post_media_read on public.post_media for select
  using (exists (select 1 from public.posts p where p.id = post_id));
create policy post_media_write on public.post_media for all
  using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));

create policy comments_read on public.comments for select
  using ((not is_hidden and exists (select 1 from public.posts p where p.id = post_id)) or public.is_platform_admin());
create policy comments_insert on public.comments for insert
  with check (user_id = auth.uid() and exists (select 1 from public.posts p where p.id = post_id and p.is_public and not p.is_hidden));
create policy comments_delete on public.comments for delete
  using (user_id = auth.uid() or public.is_platform_admin()
         or exists (select 1 from public.posts p where p.id = post_id and public.is_business_owner(p.business_id)));
create policy comments_admin_update on public.comments for update using (public.is_platform_admin());

create policy likes_own on public.likes for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy saves_own on public.saves for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy follows_own on public.follows for all using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_business_visible(business_id));

create policy notifications_own on public.notifications for select using (user_id = auth.uid());
create policy notifications_mark_read on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy analytics_read on public.analytics_events for select using (public.is_business_member(business_id) or public.is_platform_admin());

create policy reports_insert on public.reports for insert with check (reporter_id = auth.uid());
create policy reports_read on public.reports for select using (reporter_id = auth.uid() or public.is_platform_admin());
create policy reports_admin on public.reports for update using (public.is_platform_admin());

-- Function grants: anonymous visitors may submit quotes and record views; nothing else.
revoke execute on function public.submit_quote_request(uuid, text, text, text, uuid, text, text, text, text, text) from public;
grant execute on function public.submit_quote_request(uuid, text, text, text, uuid, text, text, text, text, text) to anon, authenticated;
revoke execute on function public.track_view(uuid, uuid) from public;
grant execute on function public.track_view(uuid, uuid) to anon, authenticated;
revoke execute on function public.convert_lead_to_customer(uuid) from public, anon;
grant execute on function public.convert_lead_to_customer(uuid) to authenticated;
revoke execute on function public.accept_invitation(uuid) from public, anon;
grant execute on function public.accept_invitation(uuid) to authenticated;
revoke execute on function public.business_team(uuid) from public, anon;
grant execute on function public.business_team(uuid) to authenticated;

-- =====================================================================
-- Storage buckets
--   public-media : logos, covers, post images. Public read.
--                  Path: {business_id}/... (members write) or users/{uid}/...
--   project-files: private project photos. Path: {business_id}/...
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('public-media', 'public-media', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic']),
  ('project-files', 'project-files', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

create or replace function public.storage_business_id(object_name text) returns uuid
language plpgsql immutable as $$
begin
  return (split_part(object_name, '/', 1))::uuid;
exception when others then
  return null;
end $$;

create policy "public media read" on storage.objects for select using (bucket_id = 'public-media');
create policy "public media write business" on storage.objects for insert to authenticated
  with check (bucket_id = 'public-media' and (
    public.is_business_member(public.storage_business_id(name))
    or (split_part(name, '/', 1) = 'users' and split_part(name, '/', 2) = auth.uid()::text)));
create policy "public media delete business" on storage.objects for delete to authenticated
  using (bucket_id = 'public-media' and (
    public.is_business_member(public.storage_business_id(name))
    or (split_part(name, '/', 1) = 'users' and split_part(name, '/', 2) = auth.uid()::text)));
create policy "project files member read" on storage.objects for select to authenticated
  using (bucket_id = 'project-files' and public.is_business_member(public.storage_business_id(name)));
create policy "project files member write" on storage.objects for insert to authenticated
  with check (bucket_id = 'project-files' and public.is_business_member(public.storage_business_id(name)));
create policy "project files member delete" on storage.objects for delete to authenticated
  using (bucket_id = 'project-files' and public.is_business_member(public.storage_business_id(name)));

-- =====================================================================
-- Baseline reference data (not demo data)
-- =====================================================================
insert into public.subscription_plans (id, name, description, base_price_cents, included_seats, additional_seat_price_cents, features, sort_order)
values ('basic', 'BuildFlow Basic', 'Everything a small contractor needs to win and run jobs.', 5000, 1, 2000,
        '["CRM & lead pipeline","Customer management","Project & task management","Public contractor profile","Project/work posts","Dashboard & basic analytics"]'::jsonb, 10);

insert into public.services (slug, name, plural_name, sort_order) values
  ('general-contractor', 'General Contractor', 'General Contractors', 10),
  ('electrician', 'Electrician', 'Electricians', 20),
  ('plumber', 'Plumber', 'Plumbers', 30),
  ('mason', 'Mason', 'Masons', 40),
  ('tiler', 'Tiler', 'Tilers', 50),
  ('carpenter', 'Carpenter', 'Carpenters', 60),
  ('painter', 'Painter', 'Painters', 70),
  ('roofer', 'Roofer', 'Roofers', 80),
  ('landscaper', 'Landscaper', 'Landscapers', 90),
  ('hvac', 'HVAC Technician', 'HVAC Professionals', 100),
  ('renovation', 'Home Renovation', 'Home Renovation Contractors', 110),
  ('construction-company', 'Construction Company', 'Construction Companies', 120),
  ('welder', 'Welder / Steel Work', 'Welders', 130),
  ('other', 'Other Trade', 'Other Trades', 999);

-- Jamaica as the launch market. Other countries are just more rows.
with jm as (
  insert into public.locations (country_code, level, name, slug, region_label)
  values ('JM', 'country', 'Jamaica', 'jamaica', 'Parish') returning id
)
insert into public.locations (parent_id, country_code, level, name, slug)
select jm.id, 'JM', 'region', p.name, p.slug from jm, (values
  ('Kingston', 'kingston'), ('St Andrew', 'st-andrew'), ('St Catherine', 'st-catherine'), ('Clarendon', 'clarendon'),
  ('Manchester', 'manchester'), ('St Elizabeth', 'st-elizabeth'), ('Westmoreland', 'westmoreland'), ('Hanover', 'hanover'),
  ('St James', 'st-james'), ('Trelawny', 'trelawny'), ('St Ann', 'st-ann'), ('St Mary', 'st-mary'),
  ('Portland', 'portland'), ('St Thomas', 'st-thomas')) as p(name, slug);
