# Firestore data model

Conventions: snake_case fields; timestamps are ISO-8601 strings (sortable and serialisable); denormalised copies are noted. Indexes: `firestore.indexes.json`. Access: `firestore.rules`.

## Top-level collections
| Path | Purpose | Key fields |
|---|---|---|
| `users/{uid}` | Profile (1:1 with Firebase Auth) | full_name, email, avatar_url, account_type, is_platform_admin, is_suspended, business_id, business_role |
| `users/{uid}/notifications/{id}` | In-app notifications | type, title, body, link, read_at |
| `users/{uid}/likes/{postId}`, `saves/{postId}`, `following/{businessId}` | Viewer state | created_at |
| `users/{uid}/quote_requests/{id}` | Customer's own request history (copy) | business_name, business_slug, description |
| `businesses/{id}` | **Tenant** + public contractor profile | name, name_lower, slug, tagline, description, phone, email, website, social_links, years_in_business, logo_url, cover_url, country_code, region_id, region {id,name}*, city, service_area, primary_service*, services[]*, service_ids[], is_public, is_verified, is_suspended, is_demo, onboarding_step, follower_count, post_count, completed_project_count |
| `slugs/{slug}` | Unique profile URLs | business_id |
| `subscriptions/{businessId}` | Billing state | plan_id, status, seats, trial_ends_at, current_period_end, cancel_at_period_end, stripe ids |
| `invitations/{token}` | Team invites | business_id, email, role, accepted_at |
| `posts/{id}` | Public work feed | business_id, author_id, type, caption, media[{id,url,label,position}], service_id, service*, location_text, project_id, is_public, is_hidden, **visible**, business{…}*, like/comment/save counts |
| `posts/{id}/comments/{id}` | Comments | user_id, author{full_name,avatar_url}*, body, is_hidden |
| `reports/{reporter_target}` | Moderation (one per user per target) | target_type, target_id, target_path, reason, details, status |
| `services/{slug}`, `locations/{id}`, `plans/{id}` | Reference data | locations: country_code, level (country/region/city), parent_id |

`*` = denormalised copy, refreshed by the action that changes the source.

## Tenant subcollections: `businesses/{businessId}/…` (members only)
| Collection | Key fields |
|---|---|
| `members/{uid}` | role (owner/member), full_name, avatar_url |
| `followers/{uid}` | created_at |
| `customers` | name, name_lower, phone, email, address, city, notes, status, source_lead_id |
| `leads` | name, phone, email, location, description, service_id, service_name*, status (7 stages), source, estimated_value, assigned_to, customer_id, customer_name*, quote_request_id, quote{budget_range,timeline}, status_changed_at |
| `quote_requests` | requester_id, name, email, phone, service_id, location, description, budget_range, timeline, kind (quote/contact), lead_id |
| `projects` | name, customer_id, customer_name*, lead_id, description, location, start_date, expected_end_date, status, budget, completed_at, member_ids[], task_total*, task_done* |
| `tasks` | project_id, project_name*, title, description, assigned_to, due_date, priority, status, completed_at |
| `photos` | project_id, path (private storage path), caption |
| `notes` | entity_type (lead/customer/project), entity_id, body, author_id, author_name* |
| `activity` | actor_id, actor_name*, entity_type, entity_id, action, summary |
| `events` | analytics: type (profile_view, post_view, like, comment, follow, save, quote_request, contact_click, lead_created, project_won, project_completed), created_at |

## Storage
| Path | Access |
|---|---|
| `public-media/{businessId or users/uid}/…` | Public via tokenised download URL |
| `project-files/{businessId}/…` | Private; streamed by `/media/...` to members only |
