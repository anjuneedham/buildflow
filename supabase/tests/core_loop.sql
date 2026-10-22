-- =====================================================================
-- Core-loop + tenant-isolation test. Runs against a database with the
-- migration and seed applied (e.g. `supabase db reset` locally), as a
-- superuser that can SET ROLE. Fails loudly on the first broken step.
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/core_loop.sql
-- Everything runs in a transaction that is rolled back.
-- =====================================================================
begin;

create or replace function pg_temp.as_user(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
end $$;
create or replace function pg_temp.as_anon() returns void language plpgsql as $$
begin
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
end $$;
create or replace function pg_temp.check(ok boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'FAILED: %', msg; end if;
  raise notice 'ok - %', msg;
end $$;
grant execute on all functions in schema pg_temp to anon, authenticated;

-- 1. Contractor signs up -------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data)
values ('aaaaaaaa-0000-4000-a000-000000000001', 'new@contractor.test', '{"full_name":"Test Owner","account_type":"contractor"}');
select pg_temp.check((select account_type = 'contractor' from public.profiles where id = 'aaaaaaaa-0000-4000-a000-000000000001'), 'signup creates contractor profile');

-- 2. Creates business ----------------------------------------------------
select pg_temp.as_user('aaaaaaaa-0000-4000-a000-000000000001');
insert into public.businesses (id, owner_id, name, slug, region_id)
values ('bbbbbbbb-0000-4000-a000-000000000001', 'aaaaaaaa-0000-4000-a000-000000000001', 'Test Masonry', 'test-masonry',
        (select id from public.locations where slug = 'clarendon' and level = 'region'));
select pg_temp.check((select count(*) = 1 from public.business_members where business_id = 'bbbbbbbb-0000-4000-a000-000000000001' and role = 'owner'), 'owner membership created');
select pg_temp.check((select status = 'trialing' and plan_id = 'basic' from public.subscriptions where business_id = 'bbbbbbbb-0000-4000-a000-000000000001'), 'basic trial subscription created');

-- 3. Adds services, profile visible publicly ------------------------------
insert into public.business_services (business_id, service_id) select 'bbbbbbbb-0000-4000-a000-000000000001', id from public.services where slug in ('mason', 'tiler');
update public.businesses set is_verified = true, tagline = 'Blocks & walls' where id = 'bbbbbbbb-0000-4000-a000-000000000001';
select pg_temp.check((select not is_verified and tagline = 'Blocks & walls' from public.businesses where id = 'bbbbbbbb-0000-4000-a000-000000000001'), 'owner can edit profile but cannot self-verify');

-- 4-5. Creates a post with images -----------------------------------------
insert into public.posts (id, business_id, author_id, type, caption) values
  ('cccccccc-0000-4000-a000-000000000001', 'bbbbbbbb-0000-4000-a000-000000000001', 'aaaaaaaa-0000-4000-a000-000000000001', 'service_showcase', 'Block wall');
insert into public.post_media (post_id, business_id, url) values ('cccccccc-0000-4000-a000-000000000001', 'bbbbbbbb-0000-4000-a000-000000000001', 'https://example.com/a.jpg');

-- 6-7. Customer discovers the profile and requests a quote ------------------
select pg_temp.as_anon();
select pg_temp.check((select count(*) = 1 from public.businesses where slug = 'test-masonry'), 'anonymous visitor sees public profile');
select pg_temp.check((select count(*) = 1 from public.posts where id = 'cccccccc-0000-4000-a000-000000000001'), 'anonymous visitor sees post');
select pg_temp.check((select count(*) = 0 from public.customers), 'anonymous visitor sees no CRM data');
select public.track_view('bbbbbbbb-0000-4000-a000-000000000001');

select pg_temp.as_user('00000000-0000-4000-a000-000000000005'); -- demo customer
insert into public.likes (post_id, user_id) values ('cccccccc-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000005');
insert into public.comments (post_id, user_id, body) values ('cccccccc-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000005', 'Nice work');
insert into public.follows (business_id, user_id) values ('bbbbbbbb-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000005');
select public.submit_quote_request('bbbbbbbb-0000-4000-a000-000000000001', 'Jordan Lewis', 'jordan@example.com', null,
  (select id from public.services where slug = 'mason'), 'May Pen', 'Need a 40ft boundary wall', '500k – 1M', 'Within 1 month', 'quote');
select pg_temp.check((select count(*) = 1 from public.quote_requests where business_id = 'bbbbbbbb-0000-4000-a000-000000000001'), 'customer sees own quote request');
select pg_temp.check((select count(*) = 0 from public.leads), 'customer cannot read leads');

-- 8-9. Contractor sees the lead ----------------------------------------------
select pg_temp.as_user('aaaaaaaa-0000-4000-a000-000000000001');
select pg_temp.check((select count(*) = 1 from public.leads where source = 'buildflow' and status = 'new' and quote_request_id is not null), 'quote request appears as a new BuildFlow lead');
select pg_temp.check((select count(*) >= 3 from public.notifications where type in ('quote_request', 'comment', 'follower')), 'owner notified of quote, comment and follower');
select pg_temp.check((select like_count = 1 and comment_count = 1 from public.posts where id = 'cccccccc-0000-4000-a000-000000000001'), 'post counters updated');
select pg_temp.check((select follower_count = 1 from public.businesses where id = 'bbbbbbbb-0000-4000-a000-000000000001'), 'follower counter updated');

-- 10. Convert lead -> customer ------------------------------------------------
select pg_temp.check(public.convert_lead_to_customer((select id from public.leads where business_id = 'bbbbbbbb-0000-4000-a000-000000000001')) is not null, 'lead converted to customer');
select pg_temp.check((select status = 'won' and customer_id is not null from public.leads where business_id = 'bbbbbbbb-0000-4000-a000-000000000001'), 'lead marked won and linked');

-- 11-14. Project, tasks, completion -----------------------------------------
insert into public.projects (id, business_id, customer_id, name, status, budget)
select 'dddddddd-0000-4000-a000-000000000001', 'bbbbbbbb-0000-4000-a000-000000000001', id, 'Boundary wall', 'in_progress', 750000 from public.customers where business_id = 'bbbbbbbb-0000-4000-a000-000000000001';
insert into public.tasks (business_id, project_id, title, priority) values
  ('bbbbbbbb-0000-4000-a000-000000000001', 'dddddddd-0000-4000-a000-000000000001', 'Dig footing', 'high'),
  ('bbbbbbbb-0000-4000-a000-000000000001', 'dddddddd-0000-4000-a000-000000000001', 'Lay blocks', 'medium');
update public.tasks set status = 'done' where project_id = 'dddddddd-0000-4000-a000-000000000001';
select pg_temp.check((select bool_and(completed_at is not null) from public.tasks where project_id = 'dddddddd-0000-4000-a000-000000000001'), 'tasks completed');
update public.projects set status = 'completed' where id = 'dddddddd-0000-4000-a000-000000000001';
select pg_temp.check((select completed_at is not null from public.projects where id = 'dddddddd-0000-4000-a000-000000000001'), 'project completed timestamp set');
select pg_temp.check((select completed_project_count = 1 from public.businesses where id = 'bbbbbbbb-0000-4000-a000-000000000001'), 'public completed-jobs counter updated');

-- 15. Showcase the completed work ---------------------------------------------
insert into public.posts (business_id, author_id, type, caption, project_id) values
  ('bbbbbbbb-0000-4000-a000-000000000001', 'aaaaaaaa-0000-4000-a000-000000000001', 'completed_project', 'Wall done', 'dddddddd-0000-4000-a000-000000000001');
select pg_temp.check((select post_count = 2 from public.businesses where id = 'bbbbbbbb-0000-4000-a000-000000000001'), 'completed project posted to profile');
select pg_temp.check((select count(*) filter (where event_type = 'quote_request') = 1 and count(*) filter (where event_type = 'project_completed') = 1
  from public.analytics_events where business_id = 'bbbbbbbb-0000-4000-a000-000000000001'), 'analytics recorded quote and completion');

-- Tenant isolation ------------------------------------------------------------
select pg_temp.as_user('00000000-0000-4000-a000-000000000002'); -- Island Electrical owner
select pg_temp.check((select count(*) = 0 from public.leads where business_id = 'bbbbbbbb-0000-4000-a000-000000000001'), 'other business cannot see leads');
select pg_temp.check((select count(*) = 0 from public.customers where business_id = 'bbbbbbbb-0000-4000-a000-000000000001'), 'other business cannot see customers');
select pg_temp.check((select count(*) = 0 from public.projects where business_id = 'bbbbbbbb-0000-4000-a000-000000000001'), 'other business cannot see projects');
select pg_temp.check((select count(*) = 0 from public.analytics_events where business_id = 'bbbbbbbb-0000-4000-a000-000000000001'), 'other business cannot see analytics');
do $$ begin
  begin
    insert into public.tasks (business_id, project_id, title) values ('10000000-0000-4000-a000-000000000002', 'dddddddd-0000-4000-a000-000000000001', 'sneaky');
    raise exception 'FAILED: cross-tenant task insert was allowed';
  exception when others then
    if sqlerrm like 'FAILED%' then raise; end if;
    raise notice 'ok - cross-tenant task insert rejected (%)', sqlerrm;
  end;
  begin
    insert into public.businesses (owner_id, name, slug) values ('00000000-0000-4000-a000-000000000002', 'Second Biz', 'second-biz');
    raise exception 'FAILED: second owned business allowed';
  exception when others then
    if sqlerrm like 'FAILED%' then raise; end if;
    raise notice 'ok - one owned business per user';
  end;
end $$;

-- Team member permissions ------------------------------------------------------
select pg_temp.as_user('00000000-0000-4000-a000-000000000006'); -- Kingston Pro crew
update public.leads set status = 'contacted' where business_id = '10000000-0000-4000-a000-000000000001' and status = 'new';
select pg_temp.check((select count(*) >= 1 from public.leads where business_id = '10000000-0000-4000-a000-000000000001' and status = 'contacted'), 'team member can update lead status');
delete from public.customers where business_id = '10000000-0000-4000-a000-000000000001';
select pg_temp.check((select count(*) > 0 from public.customers where business_id = '10000000-0000-4000-a000-000000000001'), 'team member cannot delete customers');
update public.businesses set name = 'Hijacked' where id = '10000000-0000-4000-a000-000000000001';
select pg_temp.check((select name = 'Kingston Pro Builders' from public.businesses where id = '10000000-0000-4000-a000-000000000001'), 'team member cannot edit business profile');

-- Privilege escalation ----------------------------------------------------------
update public.profiles set is_platform_admin = true where id = '00000000-0000-4000-a000-000000000006';
select pg_temp.check(not public.is_platform_admin(), 'users cannot make themselves admin');

reset role;
rollback;
