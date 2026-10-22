# Database schema

Source of truth: `supabase/migrations/20261022000001_init.sql`.

## Identity
| Table | Key columns | Notes |
|---|---|---|
| `profiles` | id (= auth.users.id), full_name, avatar_url, account_type, is_platform_admin, is_suspended | Created by trigger on signup. Only display columns are readable by others. |

## Reference
| Table | Notes |
|---|---|
| `locations` | Hierarchy: country → region (parish/state/province) → city. `country_code`, `level`, `parent_id`. Nothing Jamaica-specific in structure. |
| `services` | Trade taxonomy (slug, name, plural_name, is_active). Admin-managed. |
| `subscription_plans` | id ('basic'…), base_price_cents, included_seats, additional_seat_price_cents, stripe ids, features. |

## Tenant & profile
| Table | Notes |
|---|---|
| `businesses` | Tenant **and** public contractor profile (name, slug, tagline, description, contact, social_links, years, logo/cover, location, service_area, primary service, is_public, is_verified, is_suspended, is_demo, onboarding state, counters). The prompt's `contractor_profiles` is merged here to avoid a 1:1 join. |
| `business_members` | (business_id, user_id) PK, role owner/member |
| `business_invitations` | email, role, token, accepted_at |
| `business_services` | (business_id, service_id) |
| `subscriptions` | 1 per business: plan, status, seats (auto = team size), trial/period dates, Stripe ids |

## CRM & projects (all have `business_id`, member-only RLS)
| Table | Notes |
|---|---|
| `customers` | name, phone, email, address, city, notes, status |
| `leads` | contact fields, description, service, status (7 stages), source, estimated_value, assigned_to, customer_id, quote_request_id |
| `quote_requests` | Inbound requests from profiles; inserted only via RPC; readable by business + requester |
| `projects` | customer, lead, dates, status, budget, completed_at |
| `project_members` | team on a project |
| `tasks` | title, description, assignee, due_date, priority, status, completed_at |
| `project_photos` | private site photos (storage path) |
| `notes` | polymorphic (lead/customer/project); cleaned up by trigger when parent is deleted |
| `activity_logs` | human-readable history per entity |

## Social
| Table | Notes |
|---|---|
| `posts` | type, caption, project_id, service_id, location_text, is_public, is_hidden (moderation), counters |
| `post_media` | url, label (before/after), position |
| `comments`, `likes`, `saves`, `follows` | counters maintained by triggers |

## Platform
| Table | Notes |
|---|---|
| `notifications` | per user; types quote_request, new_lead, comment, follower, project_assigned, task_assigned, system; `emailed_at` reserved for email delivery |
| `analytics_events` | profile_view, post_view, like, comment, follow, save, quote_request, contact_click, lead_created, project_won, project_completed |
| `reports` | target_type (post/comment/business), reason, status, resolver |

## RPCs
`submit_quote_request`, `track_view` (anon + auth) · `convert_lead_to_customer`, `accept_invitation`, `business_team` (auth) · helpers `is_business_member`, `is_business_owner`, `is_platform_admin`, `is_business_visible`.

## Indexes
Every tenant table is indexed on `(business_id, …)` matching its list queries; trigram indexes on business and customer names; partial indexes for the public feed, open tasks and unread notifications.
