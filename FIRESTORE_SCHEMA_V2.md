# BuildFlow V2 Firestore Schema

**Companion to:** `ARCHITECTURE_V2.md` (system design, auth model, media, notifications). Section numbers below are referenced from there.
**Status:** proposed. Not implemented.
**Migration note:** V1 has never run against a production Firebase project, so these changes need code, rules, index and seed updates only. No live data migration is required. §9 lists every change from V1.

---

## 1. Conventions

| Topic | Rule |
|---|---|
| Access | **Server only.** All reads and writes go through the Admin SDK in `server/repos`. Security rules deny every client read and write (§7). |
| Field names | `snake_case`, as in V1. |
| Instants | Firestore `Timestamp` (required for TTL policies and exact ordering). Repos convert to ISO strings at the boundary for client components. V1 stored ISO strings; this changes with the repos. |
| Calendar dates | `"YYYY-MM-DD"` string in the **business timezone** (`private/config.timezone`, default `America/Jamaica`). Used for `due_date`, `start_date`, `target_end_date`, `valid_until`, `received_on`. Fixes the V1 UTC bug. |
| Money | Integer **minor units** (`*_minor`, e.g. cents) plus an ISO 4217 `currency` on every money-bearing document. Never floats. |
| Quantities | Integer thousandths (`qty_milli`), so 1.5 hours = 1500. |
| Rates | Basis points (`*_bps`), so 15% GCT = 1500. |
| IDs | Auto ids, except: client-generated ULIDs for idempotent creates (leads from the app, quotes, updates, payments, media); deterministic ids where uniqueness matters (`members/{uid}`, `reviews/{projectId}`, `slugs/{slug}`, `stats/{yyyy-mm}`, `client_links/{sha256(token)}`, `invitations/{sha256(token)}`, `subscriptions/{businessId}`). |
| Phone / email | Stored normalised: `phone_e164` ("+18765551234"), `email_lower`. Display formats are computed. |
| Array bounds | Every array has a documented maximum (keeps documents far below the 1 MiB limit and index entries bounded). |
| Validation | Each document type has a zod schema in `src/shared/schemas`; repos parse on read and write. Unknown fields are dropped on write. |
| Deletion | Soft delete only where needed for recovery (`businesses`, `users`); everything else hard deletes. |

---

## 2. Collection tree

```
users/{uid}
  notifications/{id}            in-app notifications (TTL 90d)
  devices/{deviceId}            FCM tokens
  saves/{postId}                saved posts (signed-in customers/contractors)
  blocks/{businessId}           businesses hidden by this user [verify Play UGC needs]

businesses/{businessId}         TENANT ROOT + public profile fields
  private/config                single doc: settings, counters, onboarding
  members/{uid}                 team membership (source of truth for roles)
  customers/{customerId}        contacts
  leads/{leadId}                enquiries in the pipeline
  quotes/{quoteId}              estimates/proposals with embedded lines
  projects/{projectId}          jobs
  tasks/{taskId}                tasks (business-level, reference project)
  updates/{updateId}            site updates (append-only)
  media/{mediaId}               file registry for photos/files
  invoices/{invoiceId}          invoices with embedded lines
  payments/{paymentId}          recorded payments (append-only)
  activity/{activityId}         the single timeline (notes, messages, events)
  reviews/{projectId}           verified reviews, one per project
  stats/{yyyy-mm}               monthly counters for contractor insights
  exports/{jobId}               data export jobs

posts/{postId}                  public portfolio items (Explore + profile)
slugs/{slug}                    unique profile URL → business id
client_links/{tokenHash}        capability links for customers (no login)
invitations/{tokenHash}         team invitations (TTL)
subscriptions/{businessId}      billing state
plans/{planId}                  pricing (reference)
services/{serviceSlug}          trades (reference)
locations/{locationId}          country / region (parish) / city (reference)
reports/{reportId}              moderation reports
admin_audit/{id}                append-only admin action log
rate_limits/{hash}              abuse counters (TTL)
```

**Why tenant data is in subcollections, not top-level collections with `business_id`:** a path under `businesses/{id}` makes the tenant boundary structural. A repo cannot build a tenant path without a `businessId`, and that id only ever comes from the verified actor (`ARCHITECTURE_V2.md` §5). This is V1's design and it stays.

**Why `posts` is top-level:** Explore queries across all businesses, and top-level keeps the indexes simple (no collection-group scope) and `posts/{id}` URLs short.

---

## 3. Documents

Field lists show the type and, where relevant, the bound. `*` = denormalised copy (owner listed in §4).

### 3.1 `users/{uid}`
| Field | Type | Notes |
|---|---|---|
| `full_name` | string ≤ 80 | |
| `email_lower` | string | Mirror of Auth email for admin lookup |
| `avatar_url` | string \| null | `media-public` URL |
| `account_type` | `"contractor"` \| `"customer"` | |
| `business_id` | string \| null | Mirror of the membership; written in the same transaction as `members/{uid}`; source for the `bid` claim |
| `is_platform_admin` | bool | Source for the `adm` claim |
| `is_suspended` | bool | Also disables the Auth user |
| `notification_prefs` | map `{event: {push: bool, email: bool}}`, ≤ 10 events | Defaults applied in code when absent |
| `created_at`, `deleted_at` | Timestamp, Timestamp \| null | Soft delete; purged after 30 days |

**`users/{uid}/notifications/{id}`:** `type`, `title` ≤ 120, `body` ≤ 300, `link` (app path), `business_id`, `read_at` (Timestamp \| null), `delivered_at` (Timestamp \| null), `created_at`, `expire_at` (Timestamp, TTL = created + 90 d).
**`users/{uid}/devices/{deviceId}`:** `fcm_token`, `platform` (`android` \| `web`), `app_version`, `updated_at`. Max ~5 per user (oldest removed).
**`users/{uid}/saves/{postId}`:** `created_at`, `business_id`.
**`users/{uid}/blocks/{businessId}`:** `created_at`. Hides that business from this user's Explore and search results (server-side filter on the page).

### 3.2 `businesses/{businessId}` (public profile + listing state)
Only fields that are safe to render publicly and needed for listing live here. Settings and counters that change often live in `private/config`.

| Field | Type | Notes |
|---|---|---|
| `owner_id` | string | Must match `members/{owner}.role == "owner"` |
| `status` | `"active"` \| `"suspended"` \| `"deleted"` | |
| `name`, `slug` | string ≤ 80, string | `slug` unique via `slugs/{slug}` |
| `tagline` ≤ 120, `description` ≤ 2000 | string | |
| `phone_e164`, `whatsapp_e164`, `email_lower`, `website` | string \| null | Public contact (contractor chooses) |
| `phone_verified` | bool | P1 trust signal; false in V2 unless verified |
| `logo`, `cover` | map `{url_base, w, h, blurhash}` \| null | `media-public` variants |
| `country_code` | string | `"JM"` |
| `region_id` | string \| null | Parish (`locations` level `region`) |
| `region_name`* | string \| null | Display copy |
| `city`, `service_area` | string \| null | |
| `service_ids` | string[] ≤ 10 | Filterable |
| `services`* | `[{id, name, slug}]` ≤ 10 | Display copy of reference data |
| `years_in_business` | number \| null | |
| `is_public` | bool | Contractor's choice |
| `is_listed` | bool | **Computed:** `is_public && status == "active" && email verified && profile complete` (name, ≥ 1 service, region, logo or cover). The only listing filter in queries |
| `is_verified` | bool | BuildFlow verification badge (admin-set) |
| `search_tokens` | string[] ≤ 60 | Lowercase word prefixes (≥ 2 chars) of name and services |
| `rank` | number | Computed: completed projects, reviews, recency; used for browse ordering |
| `post_count`, `completed_project_count`, `review_count`, `rating_sum` | number | Counters (rating average = sum / count) |
| `response` | `{count, total_minutes}` | First-response time on leads, for "usually replies within…" |
| `created_at`, `updated_at` | Timestamp | |

### 3.3 `businesses/{id}/private/config` (single document)
| Field | Type | Notes |
|---|---|---|
| `currency` | `"JMD"` \| `"USD"` | Default for new quotes/invoices |
| `timezone` | IANA string | Default `America/Jamaica` |
| `tax` | `{label: "GCT", rate_bps, number: string \| null, prices_include_tax: bool}` | |
| `quote_prefix`, `next_quote_number` | string, number | Incremented in a transaction |
| `invoice_prefix`, `next_invoice_number` | string, number | |
| `quote_defaults` | `{valid_days, deposit: {type: "percent" \| "fixed", value}, terms ≤ 2000}` | |
| `onboarding` | `{step, completed_at}` | |
| `checklist` | map of booleans | Derived from counters; cached here to avoid recomputing |

### 3.4 `businesses/{id}/members/{uid}`
`role` (`owner` \| `admin` \| `field`), `full_name`*, `avatar_url`*, `joined_at`, `invited_by`. **Source of truth for roles.** Claims (`bid`, `brole`) and `users.business_id` are derived from it in the same service call.

### 3.5 `businesses/{id}/customers/{customerId}`
| Field | Type | Notes |
|---|---|---|
| `name` ≤ 120, `name_lower` | string | `name_lower` for prefix search |
| `phone_e164`, `email_lower` | string \| null | Dedup keys for quote requests |
| `address` ≤ 300, `region_id`, `city` | string \| null | |
| `stage` | `"prospect"` \| `"active"` \| `"past"` | prospect until first accepted quote |
| `source` | `"profile"` \| `"explore"` \| `"referral"` \| `"manual"` \| `"import"` | |
| `blocked` | bool | Contractor blocked this contact; client links revoked, quote requests from these keys rejected |
| `last_activity_at` | Timestamp | Sort key |
| `created_at`, `updated_at` | Timestamp | |

Notes are **not** a field; they are `activity` entries (`type: "note"`).

### 3.6 `businesses/{id}/leads/{leadId}`
| Field | Type | Notes |
|---|---|---|
| `customer_id` | string | Always set (find-or-create on quote request) |
| `customer`* | `{name, phone_e164}` | List display without a join |
| `service_id`, `service_name`* | string \| null | |
| `status` | `"new"` \| `"contacted"` \| `"quoted"` \| `"won"` \| `"lost"` | V1 had 7 stages; reduced for simplicity (strategy §11.2) |
| `status_changed_at` | Timestamp | |
| `source` | as customer `source` | |
| `request` | `{description ≤ 2000, budget_range, timeline, location_text, submitted_at}` \| null | The raw quote request (replaces V1's separate `quote_requests` collection) |
| `estimated_value_minor`, `currency` | number \| null, string | |
| `assigned_to` | uid \| null | owner/admin only |
| `next_follow_up_at` | Timestamp \| **absent** | Field is deleted (not null) when closed or reminded, so the reminder query only scans due leads |
| `first_response_at` | Timestamp \| null | Feeds `businesses.response` |
| `project_id` | string \| null | Set on win |
| `lost_reason` | string \| null | |
| `created_at`, `updated_at` | Timestamp | |

### 3.7 `businesses/{id}/quotes/{quoteId}`
| Field | Type | Notes |
|---|---|---|
| `number` | string | `prefix + next_quote_number`, from `private/config` in the create transaction |
| `customer_id`, `lead_id`, `project_id` | string, string \| null, string \| null | |
| `customer`* | `{name, email_lower, phone_e164}` | Snapshot; updated while draft/sent, **frozen after acceptance** |
| `title` ≤ 120 | string | |
| `status` | `"draft"` \| `"sent"` \| `"viewed"` \| `"accepted"` \| `"declined"` \| `"expired"` | |
| `revision` | number | +1 each time a sent quote is edited and re-sent |
| `currency` | string | Copied from config at creation; immutable |
| `lines` | `[{id, description ≤ 300, qty_milli, unit_price_minor, tax_rate_bps, amount_minor}]` ≤ 200 | Not indexed (field override) |
| `subtotal_minor`, `tax_minor`, `total_minor` | number | Computed server-side only |
| `deposit` | `{type, value, amount_minor}` \| null | |
| `notes_to_client` ≤ 2000, `terms` ≤ 2000 | string \| null | |
| `valid_until` | date string | |
| `link_id` | string \| null | `client_links` doc id (hash) |
| `link_token` | string \| null | Raw token so members can re-share the link. Tenant-private, server-only |
| `sent_at`, `first_viewed_at` | Timestamp \| null | |
| `accepted` | `{at, name_typed, ip_hash, user_agent ≤ 200, revision, total_minor}` \| null | Immutable acceptance record; quote is read-only afterwards |
| `declined` | `{at, reason ≤ 500}` \| null | |
| `created_by`, `created_at`, `updated_at` | | |

### 3.8 `businesses/{id}/projects/{projectId}`
| Field | Type | Notes |
|---|---|---|
| `name` ≤ 120 | string | |
| `customer_id`, `lead_id`, `quote_id` | string, string \| null, string \| null | |
| `customer_name`* | string | List display |
| `status` | `"planning"` \| `"active"` \| `"on_hold"` \| `"completed"` \| `"canceled"` | |
| `location_text` ≤ 300 | string \| null | |
| `start_date`, `target_end_date` | date string \| null | |
| `completed_at` | Timestamp \| null | |
| `member_ids` | uid[] ≤ 20 | Field access (`array-contains`) |
| `task_counts` | `{total, done}` | Maintained in task transactions |
| `money` | `{currency, quoted_minor, invoiced_minor, paid_minor}` | Maintained in quote/invoice/payment transactions |
| `cover` | `{media_id, blurhash}` \| null | |
| `link_id`, `link_token` | string \| null | Same link as the accepted quote |
| `share_updates_default` | bool | Default true |
| `review_requested_at` | Timestamp \| null | |
| `last_update_at`, `created_at`, `updated_at` | Timestamp | |

### 3.9 `businesses/{id}/tasks/{taskId}`
`project_id`, `project_name`*, `title` ≤ 200, `notes` ≤ 1000, `assigned_to` (uid \| null), `due_date` (date string \| null), `priority` (`low` \| `normal` \| `high`), `status` (`todo` \| `in_progress` \| `done`), `completed_at`, `completed_by`, `client_updated_at` (Timestamp; last-write-wins for offline), `digest_sent_on` (date string \| null), `created_at`, `updated_at`.

### 3.10 `businesses/{id}/updates/{updateId}` (append-only)
`project_id`, `author_id`, `author_name`*, `note` ≤ 2000, `media` (`[{id, w, h, blurhash, ready}]` ≤ 10, `ready`/dims written by `mediaProcess`), `shared_with_client` (bool), `client_created_at`, `created_at`. Edits limited to `note` and `shared_with_client` within 24 h by the author or owner/admin.

### 3.11 `businesses/{id}/media/{mediaId}`
| Field | Type | Notes |
|---|---|---|
| `kind` | `"image"` \| `"file"` | |
| `purpose` | `"project_photo"` \| `"project_file"` \| `"logo"` \| `"cover"` | |
| `project_id`, `update_id` | string \| null | |
| `status` | `"uploading"` \| `"processing"` \| `"ready"` \| `"failed"` | |
| `error` | string \| null | User-safe reason |
| `content_type`, `bytes`, `file_name` ≤ 200 | | Real type after sniffing |
| `w`, `h`, `blurhash` | | Images only |
| `variants` | string[] e.g. `["w320","w640","w1280","w2048","w1280.jpg"]` | Paths are deterministic: `media-private/{bid}/{mediaId}/{variant}` |
| `label` | `"before"` \| `"after"` \| null | For portfolio pairing |
| `uploaded_by`, `created_at`, `ready_at` | | |

### 3.12 `businesses/{id}/invoices/{invoiceId}`
`number`, `project_id`, `customer_id`, `quote_id`, `kind` (`deposit` \| `progress` \| `final`), `currency`, `lines` (≤ 200, same shape as quote lines), `subtotal_minor`, `tax_minor`, `total_minor`, `paid_minor`, `status` (`draft` \| `sent` \| `partially_paid` \| `paid` \| `void`), `due_date`, `sent_at`, `created_by`, `created_at`, `updated_at`.
V2 records payments; it does not process them (strategy §11.4).

### 3.13 `businesses/{id}/payments/{paymentId}` (append-only; void creates a reversing entry)
`project_id`, `invoice_id` (\| null), `customer_id`, `amount_minor` (negative for reversal), `currency`, `method` (`cash` \| `bank_transfer` \| `card` \| `cheque` \| `other`), `received_on` (date string), `reference` ≤ 120, `recorded_by`, `client_created_at`, `created_at`.

### 3.14 `businesses/{id}/activity/{activityId}` (the timeline; append-only)
| Field | Type | Notes |
|---|---|---|
| `type` | `"note"`, `"call"`, `"whatsapp"`, `"email"`, `"message_in"`, `"message_out"`, `"lead_created"`, `"status_changed"`, `"quote_sent"`, `"quote_viewed"`, `"quote_accepted"`, `"quote_declined"`, `"project_created"`, `"update_posted"`, `"payment_recorded"`, `"invoice_sent"`, `"review_received"`, `"task_completed"` | |
| `customer_id`, `lead_id`, `project_id`, `quote_id` | string \| null | At least one of customer/project set |
| `actor` | `{type: "member" \| "client" \| "system", id \| null, name}`* | Name is a historical snapshot |
| `body` ≤ 4000 | string \| null | Notes and messages. Not indexed |
| `link_id` | string \| null | Set on client-visible entries |
| `client_visible` | bool | Messages and shared events shown on the client link |
| `created_at` | Timestamp | |

### 3.15 `businesses/{id}/reviews/{projectId}`
`rating` (1–5), `body` ≤ 2000, `reviewer_display` ("Marcia T."), `service_name`*, `project_completed_on` (date string), `status` (`published` \| `hidden` \| `pending`), `reply` (`{body ≤ 1000, at}` \| null), `link_id`, `ip_hash`, `created_at`.
The id equals the project id: **one review per completed project, structurally.** Only a valid client link for a completed project can create it, which is what makes it "verified".

### 3.16 `businesses/{id}/stats/{yyyy-mm}`
`totals: {profile_views, post_views, quote_requests, contact_clicks, leads_created, quotes_sent, quotes_accepted, projects_completed, reviews}` and `days: {"01": {...same keys}, ..., "31": {...}}`. Incremented with `FieldValue.increment` by the services that cause each event.

### 3.17 `businesses/{id}/exports/{jobId}`
`requested_by`, `status` (`queued` \| `running` \| `ready` \| `failed`), `object_path`, `expires_at`, `created_at`.

### 3.18 `posts/{postId}` (public portfolio item)
| Field | Type | Notes |
|---|---|---|
| `business_id` | string | |
| `business`* | `{name, slug, logo_url_base, is_verified, region_name}` | Card rendering without a business read |
| `project_id` | string \| null | Present = "Verified job" badge |
| `type` | `"project"` \| `"before_after"` \| `"photo"` | |
| `caption` ≤ 1000 | string \| null | Not indexed |
| `media` | `[{url_base, w, h, blurhash, label}]` ≤ 10 | `media-public` variant base paths. Not indexed |
| `service_id` | string \| null | |
| `service`* | `{name, slug}` \| null | |
| `region_id`* | string \| null | **Flattened** (V1 used `business.region_id`) |
| `status` | `"processing"` \| `"published"` \| `"archived"` | |
| `is_hidden` | bool | Moderation |
| `business_listed`* | bool | Copy of `businesses.is_listed` |
| `visible` | bool | **Computed:** `status == "published" && !is_hidden && business_listed`. The only flag queries use |
| `save_count` | number | Internal only; not displayed in V2 |
| `published_at`, `created_at`, `updated_at` | Timestamp | |

V1's `like_count`, `comment_count`, the `comments` subcollection, `users/*/likes`, `following` and `followers` are **dropped** (strategy: likes, comments and follower feed are out of V2).

### 3.19 `client_links/{sha256(token)}`
| Field | Type | Notes |
|---|---|---|
| `business_id`, `customer_id` | string | |
| `quote_ids` | string[] ≤ 10 | Quotes viewable through this link |
| `project_id` | string \| null | Set when a quote is accepted |
| `status` | `"active"` \| `"revoked"` | |
| `expires_at` | Timestamp \| null | Null while the project is open; 180 days after completion |
| `created_by`, `created_at`, `last_opened_at` | | `last_opened_at` written at most once per hour |
| `last_message` | `{at, preview ≤ 120, from: "client" \| "member"}` \| null | Inbox thread list (owner: `postMessage` service, same batch as the `activity` entry) |
| `unread_for_business` | bool | Set when the client writes; cleared when a member opens the thread |

The token is 32 random bytes, base64url in the URL `/c/{token}`. Only its SHA-256 is a document id. The raw token is stored only on the tenant-private quote/project so members can re-share it.

### 3.20 Other top-level documents
| Collection | Fields |
|---|---|
| `slugs/{slug}` | `business_id`, `created_at` |
| `invitations/{sha256(token)}` | `business_id`, `email_lower`, `role` (`admin` \| `field`), `status` (`pending` \| `accepted` \| `revoked`), `invited_by`, `created_at`, `expire_at` (TTL, 14 d) |
| `subscriptions/{businessId}` | `plan_id`, `status` (`trialing` \| `active` \| `past_due` \| `read_only` \| `canceled`), `seats_paid`, `trial_ends_at`, `current_period_end`, `provider` (`stripe` \| `play` \| `manual`), `provider_customer_id`, `provider_subscription_id`, `last_event_id`, `updated_at` |
| `plans/{planId}` | As V1 (`name`, `currency`, `base_price_cents`, `included_seats`, `additional_seat_price_cents`, `features[]`, `active`) |
| `services/{slug}` | `name`, `plural_name`, `sort` |
| `locations/{id}` | `name`, `slug`, `level` (`country` \| `region` \| `city`), `country_code`, `parent_id` |
| `reports/{id}` | `target_type` (`post` \| `review` \| `business` \| `message`), `target_path`, `reason`, `details` ≤ 1000, `reporter` (`{uid \| null, ip_hash}`), `status` (`open` \| `actioned` \| `dismissed`), `resolved_by`, `created_at`, `resolved_at` |
| `admin_audit/{id}` | `admin_uid`, `action`, `target_path`, `reason`, `created_at` |
| `rate_limits/{sha256(scope+key+window)}` | `count`, `expire_at` (TTL) |

---

## 4. Denormalisation register

Every copied field, its source, and the **one** place that keeps it correct. A copy without an owner is not allowed (`ARCHITECTURE_V2.md` §14 check 3).

| Copy | Source | Owner (keeps it in sync) | Why the copy exists |
|---|---|---|---|
| `posts.business{…}`, `posts.region_id` | `businesses` | `businessFanout` Function (on business update; ≤ a few hundred posts per business) | Explore renders 20 cards with 0 extra reads |
| `posts.business_listed`, `posts.visible` | `businesses.is_listed`, post fields | Post services (own fields) + `listingSync` Function | One boolean filter for every feed query |
| `posts.service{…}`, `leads.service_name`, `businesses.services[]`, `reviews.service_name` | `services` | Admin rename runs a backfill script (rare) | Display without reference-data reads |
| `businesses.region_name` | `locations` | Profile service; admin rename backfill | Display |
| `leads.customer{…}`, `projects.customer_name`, `quotes.customer{…}` (draft/sent only) | `customers` | `updateCustomer` service, same request, bounded (≤ 50 docs) | Lists without per-row joins |
| `tasks.project_name` | `projects.name` | `renameProject` service (≤ 200 tasks) | "My tasks" across projects without joins |
| `members.full_name/avatar_url` | `users` | Profile update service | Team lists |
| `updates.media[].ready/w/h/blurhash` | `media` | `mediaProcess` Function | Update cards without media reads |
| `projects.task_counts` | `tasks` | Task services, in transaction | Progress bars |
| `projects.money` | quotes, invoices, payments | Money services, in transaction | Project hub and client link summary |
| `businesses.post_count, review_count, rating_sum, completed_project_count, response, rank, search_tokens, is_listed` | Respective collections | The service that changes the source, in transaction | Profile and listing |
| `users.business_id`, claims `bid/brole` | `members` | Membership service, same transaction (claims right after) | Session without reads |
| `stats/*` | Events | Causing service, same batch | Insights in 2 reads |

**Deliberately not copied** (the server joins instead, because authorization already requires loading the parent):
- The field user's view of a project's customer contact. The server reads `customers/{id}` after the project membership check, rather than copying contact details onto projects.
- The client link's business profile. That is the cached `businesses/{id}` read.

**Historical snapshots** (intentionally never updated): `activity.actor.name`, `updates.author_name`, accepted-quote `customer` snapshot, `quotes.accepted`. These record what was true at the time.

---

## 5. Indexes

### 5.1 Composite indexes (`firestore.indexes.json`)
Tenant subcollections use `COLLECTION` scope; the index applies to that subcollection under every business. `COLLECTION_GROUP` is used only by scheduled jobs that scan across businesses.

| # | Collection | Scope | Fields | Serves (query id in §6) |
|---|---|---|---|---|
| 1 | posts | C | `visible` ↑, `published_at` ↓ | Q-E1 Explore all |
| 2 | posts | C | `visible` ↑, `service_id` ↑, `published_at` ↓ | Q-E2 by service |
| 3 | posts | C | `visible` ↑, `region_id` ↑, `published_at` ↓ | Q-E3 by area |
| 4 | posts | C | `visible` ↑, `service_id` ↑, `region_id` ↑, `published_at` ↓ | Q-E4 service + area (**missing in V1**) |
| 5 | posts | C | `business_id` ↑, `visible` ↑, `published_at` ↓ | Q-P2 profile portfolio |
| 6 | posts | C | `business_id` ↑, `created_at` ↓ | Q-A1 manage my posts |
| 7 | businesses | C | `is_listed` ↑, `rank` ↓ | Q-S1 browse |
| 8 | businesses | C | `is_listed` ↑, `region_id` ↑, `rank` ↓ | Q-S2 |
| 9 | businesses | C | `is_listed` ↑, `service_ids` CONTAINS, `rank` ↓ | Q-S3 |
| 10 | businesses | C | `is_listed` ↑, `service_ids` CONTAINS, `region_id` ↑, `rank` ↓ | Q-S4 |
| 11 | businesses | C | `is_listed` ↑, `search_tokens` CONTAINS, `rank` ↓ | Q-S5 name search |
| 12 | businesses | C | `is_listed` ↑, `search_tokens` CONTAINS, `region_id` ↑, `rank` ↓ | Q-S6 name + area |
| 13 | customers | C | `stage` ↑, `last_activity_at` ↓ | Q-C1 |
| 14 | leads | C | `status` ↑, `created_at` ↓ | Q-L1 pipeline |
| 15 | leads | C | `assigned_to` ↑, `status` ↑, `created_at` ↓ | Q-L2 my leads |
| 16 | leads | C | `customer_id` ↑, `created_at` ↓ | Q-L3 |
| 17 | quotes | C | `status` ↑, `created_at` ↓ | Q-Q1 |
| 18 | quotes | C | `customer_id` ↑, `created_at` ↓ | Q-Q2 |
| 19 | quotes | CG | `status` ↑, `valid_until` ↑ | Q-J2 expiry job |
| 20 | projects | C | `status` ↑, `updated_at` ↓ | Q-PR1 |
| 21 | projects | C | `member_ids` CONTAINS, `status` ↑, `updated_at` ↓ | Q-PR2 field view |
| 22 | projects | C | `customer_id` ↑, `created_at` ↓ | Q-PR3 |
| 23 | tasks | C | `assigned_to` ↑, `status` ↑, `due_date` ↑ | Q-T1 my tasks |
| 24 | tasks | C | `project_id` ↑, `created_at` ↑ | Q-T2 project tasks |
| 25 | tasks | C | `status` ↑, `due_date` ↑ | Q-T3 dashboard due |
| 26 | tasks | CG | `status` ↑, `due_date` ↑ | Q-J3 morning digest |
| 27 | updates | C | `project_id` ↑, `created_at` ↓ | Q-U1 |
| 28 | updates | C | `project_id` ↑, `shared_with_client` ↑, `created_at` ↓ | Q-U2 client link |
| 29 | media | C | `project_id` ↑, `status` ↑, `created_at` ↓ | Q-M1 gallery |
| 30 | activity | C | `customer_id` ↑, `created_at` ↓ | Q-AC1 contact timeline |
| 31 | activity | C | `project_id` ↑, `created_at` ↓ | Q-AC2 project timeline |
| 32 | activity | C | `link_id` ↑, `client_visible` ↑, `created_at` ↑ | Q-AC3 client messages |
| 33 | invoices | C | `project_id` ↑, `created_at` ↓ | Q-I1 |
| 34 | payments | C | `project_id` ↑, `received_on` ↓ | Q-PY1 |
| 35 | reviews | C | `status` ↑, `created_at` ↓ | Q-P3 profile reviews |
| 36 | invitations | C | `business_id` ↑, `status` ↑, `created_at` ↓ | Q-TM2 |
| 37 | reports | C | `status` ↑, `created_at` ↓ | Q-AD1 (**missing in V1**) |
| 38 | client_links | C | `business_id` ↑, `status` ↑, `last_message.at` ↓ | Q-IN1 Inbox threads |

**Queries that need no composite index** (single-field or equality-only): `customers` by `name_lower` range; `customers` by `phone_e164` / `email_lower`; `leads` by `next_follow_up_at` within a business; `members` by `role`; `notifications` by `created_at` and `read_at == null`; `quotes`/`invoices` by `project_id` or `lead_id` equality; `admin_audit` by `created_at`.

### 5.2 Field overrides
- **Collection-group single-field index:** `leads.next_follow_up_at` (ascending) for Q-J1, the reminder job across businesses.
- **Collection-group single-field index:** `customers.email_lower` for Q-FJ1 ("Find my job": rate-limited, the response never reveals whether a match exists).
- **Exempt from indexing** (cuts write cost and index entries; these fields are never queried): `posts.caption`, `posts.media`, `posts.business`, `quotes.lines`, `quotes.terms`, `quotes.notes_to_client`, `invoices.lines`, `activity.body`, `leads.request`, `updates.note`, `updates.media`, `businesses.description`, `businesses.services`, `customers.address`, `reviews.body`, `stats.days`.

### 5.3 TTL policies
`users/*/notifications.expire_at`, `invitations.expire_at`, `rate_limits.expire_at`. TTL deletion is asynchronous (typically within days, **[verify]** current SLA), so code also filters expired invitations on read.

### 5.4 Enforcement in CI
The emulator does not enforce composite indexes. That is how V1 shipped two missing ones. CI therefore:
1. Statically checks each repo query declaration (repos export their query shapes) against `firestore.indexes.json`.
2. Runs a nightly job that executes every query against the **staging** project, where indexes are enforced.

---

## 6. Read and write patterns

### 6.1 Pagination standard
- Every list query: `orderBy(<sort field>), orderBy(__name__)` + `limit(n)` with `n ≤ 50` (default 20–25).
- Cursor = base64url of `[sortValue, docId]`, opaque to the client; the server rebuilds `startAfter(sortValue, docId)`. Stable under inserts; no offsets.
- Counts for badges use `count()` aggregation (billed as 1 read per up to 1,000 index entries), never a fetch of documents.

### 6.2 Per-request baseline
| Item | Reads |
|---|---|
| Session (claims in cookie) | **0** (V1: ~3 + Auth call) |
| App layout: business name/logo | 0–1 (cached by tag `biz:{id}`) |
| Unread notification badge | 1 (`count()`) |

### 6.3 Screen read budgets (upper bounds, uncached)
| Screen | Queries | Reads |
|---|---|---|
| Dashboard | follow-ups due ≤ 5 (single-field), tasks due ≤ 5 (Q-T3 or Q-T1), active projects ≤ 5 (Q-PR1/2), recent activity ≤ 10, stats 2 docs, open leads `count()`, subscription 1 | **≤ 30** |
| Leads list | Q-L1 page of 25 + `count()` per stage tab (≤ 5) | ≤ 30 |
| Lead detail | lead 1, customer 1, timeline Q-AC1 25, quotes Q-Q2 ≤ 5 | ≤ 32 |
| Customer detail | customer 1, Q-AC1 25, Q-PR3 ≤ 10, Q-Q2 ≤ 10 | ≤ 46 |
| Quote editor | quote 1, config 1, customer 1 | 3 |
| Project hub | project 1, customer 1, Q-T2 ≤ 50, Q-U1 10, Q-I1 ≤ 10, Q-PY1 ≤ 10, Q-AC2 10 | ≤ 92 (typ. ~35) |
| My tasks (field) | Q-T1 25 | 25 |
| Client link `/c/[token]` | link 1, quote(s) ≤ 3 or project 1, Q-U2 10, Q-AC3 20, Q-I1 ≤ 5, business (cached) | ≤ 40 |
| Explore page | Q-E1..4 30 (diversity over-fetch) | 30, **cached 60 s per path** |
| Contractor profile | business 1, Q-P2 12, Q-P3 5 | 18, **ISR** |
| Search | Q-S1..6 20 | 20 |
| Notifications | 20 | 20 |
| Inbox threads | Q-IN1 20 | 20 |
| Admin reports | Q-AD1 25 | 25 |

For comparison, V1's Explore read ~530 documents per view and its analytics page up to 50,000.

### 6.4 Query catalogue
Each repo query has an id used above and in §5.

| Id | Collection | Filter / order | Index |
|---|---|---|---|
| Q-E1 | posts | `visible==true` / `published_at desc` | 1 |
| Q-E2 | posts | `+ service_id==S` | 2 |
| Q-E3 | posts | `+ region_id==R` | 3 |
| Q-E4 | posts | `+ service_id==S, region_id==R` | 4 |
| Q-P2 | posts | `business_id==B, visible==true` / `published_at desc` | 5 |
| Q-A1 | posts | `business_id==B` / `created_at desc` | 6 |
| Q-P3 | reviews (tenant) | `status=="published"` / `created_at desc` | 35 |
| Q-S1..S4 | businesses | `is_listed==true [, region_id==R] [, service_ids contains S]` / `rank desc` | 7–10 |
| Q-S5..S6 | businesses | `is_listed==true, search_tokens contains T [, region_id==R]` / `rank desc` | 11–12 |
| Q-C1 | customers | `stage==X` / `last_activity_at desc` | 13 |
| Q-C2 | customers | `name_lower >= p, < p+""` / `name_lower` | single |
| Q-C3 | customers | `phone_e164==P` (limit 1), else `email_lower==E` (limit 1) | single |
| Q-L1 | leads | `status in [...]` / `created_at desc` | 14 |
| Q-L2 | leads | `assigned_to==U, status in [...]` / `created_at desc` | 15 |
| Q-L3 | leads | `customer_id==C` / `created_at desc` | 16 |
| Q-L4 | leads | `next_follow_up_at <= now` / `next_follow_up_at` | single |
| Q-Q1 | quotes | `status in [...]` / `created_at desc` | 17 |
| Q-Q2 | quotes | `customer_id==C` / `created_at desc` | 18 |
| Q-PR1 | projects | `status in [...]` / `updated_at desc` | 20 |
| Q-PR2 | projects | `member_ids contains U, status==X` / `updated_at desc` | 21 |
| Q-PR3 | projects | `customer_id==C` / `created_at desc` | 22 |
| Q-T1 | tasks | `assigned_to==U, status in ["todo","in_progress"]` / `due_date` | 23 |
| Q-T2 | tasks | `project_id==P` / `created_at` | 24 |
| Q-T3 | tasks | `status in [...], due_date <= today` / `due_date` | 25 |
| Q-U1 | updates | `project_id==P` / `created_at desc` | 27 |
| Q-U2 | updates | `project_id==P, shared_with_client==true` / `created_at desc` | 28 |
| Q-M1 | media | `project_id==P, status=="ready"` / `created_at desc` | 29 |
| Q-AC1 | activity | `customer_id==C` / `created_at desc` | 30 |
| Q-AC2 | activity | `project_id==P` / `created_at desc` | 31 |
| Q-AC3 | activity | `link_id==L, client_visible==true` / `created_at` | 32 |
| Q-I1 | invoices | `project_id==P` / `created_at desc` | 33 |
| Q-PY1 | payments | `project_id==P` / `received_on desc` | 34 |
| Q-TM1 | members | all (≤ 50) | none |
| Q-TM2 | invitations | `business_id==B, status=="pending"` / `created_at desc` | 36 |
| Q-AD1 | reports | `status=="open"` / `created_at desc` | 37 |
| Q-IN1 | client_links | `business_id==B, status=="active"` / `last_message.at desc` (links without messages have no `last_message.at` and are excluded) | 38 |
| Q-FJ1 | customers (CG) | `email_lower==E`, limit 20 → then `client_links` `customer_id==C, status=="active"` per match | field override |
| Q-J1 | leads (CG) | `next_follow_up_at <= now` / `next_follow_up_at`, limit 500 per run | field override |
| Q-J2 | quotes (CG) | `status in ["sent","viewed"], valid_until < today` | 19 |
| Q-J3 | tasks (CG) | `status in ["todo","in_progress"], due_date == today` | 26 |

**Field-role scoping is applied in the query, not after it:** field users only ever run Q-PR2, Q-T1, and Q-T2/Q-U1/Q-M1 after a project membership check. They never run Q-L*, Q-C*, Q-Q* or Q-I* (the policy denies them first).

### 6.5 Write patterns (services)
Each service runs in one transaction or batch. "Reads" are the documents read inside the transaction.

| Service | Policy action | Reads | Writes |
|---|---|---|---|
| `submitQuoteRequest` (public) | `public.quote_request` + App Check + rate limit | business 1, customer lookup 1–2, rate limit 1–2 | customer (create/update) 1, lead 1, activity 1, notifications ≤ 3, stats 1, rate limit 1–2 → **≤ 9** |
| `respondToLead` (first call/WhatsApp tap) | `lead.update` | lead 1, business 1 | lead 1, activity 1, business `response` 1 |
| `createQuote` | `quote.create` | config 1, customer 1 | quote 1, config (number) 1 |
| `sendQuote` | `quote.send` | quote 1, link 0–1 | quote 1, client_link 0–1, lead status 1, activity 1, stats 1; email to customer async |
| `viewQuote` (client) | link scope | link 1, quote 1 | quote `first_viewed_at` + status 1 (first view only), activity 1, notification ≤ 3 (first view only) |
| `acceptQuote` (client) | link scope | link 1, quote 1, lead 1 | quote 1, project 1, lead 1, client_link 1, customer stage 1, activity 1, notifications ≤ 3, stats 1 → **≤ 10**; idempotent on `quote.status` |
| `postUpdate` (incl. offline replay) | `update.create` (project membership) | project 1 | update 1 (create-if-absent by client id), project `last_update_at` 1, activity 1, notifications ≤ 3 |
| `setTaskStatus` | `task.update` | task 1, project 1 | task 1, project `task_counts` 1, activity 1 (on done) |
| `recordPayment` | `payment.create` | project 1, invoice 0–1 | payment 1, invoice 0–1, project `money` 1, activity 1, stats 1 |
| `createUploadSlots` | `media.upload` | project 0–1, subscription 1 | media docs ≤ 10 |
| `publishToPortfolio` | `post.publish` (owner/admin, verified email) | project 1, media ≤ 10, business 1 | post 1, business `post_count`/`rank` 1; Storage server-side copies; revalidate tags |
| `deletePost` | `post.delete` | post 1 | post delete 1, business counter 1; delete public objects |
| `completeProject` | `project.complete` | project 1 | project 1, business `completed_project_count`/`rank` 1, activity 1, stats 1; review request email async |
| `submitReview` (client) | link scope + project completed | link 1, project 1, review 0 (create-only) | review 1, business aggregate 1, project 1, activity 1, notifications ≤ 3 |
| `postMessage` (client or member) | link scope / `message.send` | link 1 | activity 1 (`message_in`/`message_out`, `client_visible`), client_link `last_message` + `unread_for_business` 1, notifications ≤ 3 (client → team) or customer email (member → client) |
| `updateCustomer` | `customer.update` | customer 1, leads/projects/quotes ≤ 50 (ids only) | customer 1 + bounded fan-out (§4) |
| `inviteMember` / `acceptInvite` | `team.invite` / invite token | subscription 1, members `count()` / invitation 1 | invitation 1 / member 1, user 1, invitation 1; then claims + revoke |
| `updateProfile` | `business.update` | business 1 | business 1; `businessFanout` updates posts async |

### 6.6 Hot-document limits
- `private/config` (quote/invoice numbering): low write rate per business; transactions serialise correctly.
- `stats/{yyyy-mm}`: one doc per business per month. Upgrade trigger: shard if a single business exceeds ~1 sustained write/s (`ARCHITECTURE_V2.md` §11).
- `businesses/{id}` counters: written only by low-frequency events (post, review, completed project), not by views.
- No global counters anywhere.

---

## 7. Security rules

### 7.1 Firestore: deny all clients
The browser bundle does not include the Firestore SDK. The server uses the Admin SDK, which bypasses rules. The rules therefore exist to prove that **no client path exists**:

```
rules_version = '2';
// BuildFlow: all Firestore access is server-side (Admin SDK) after
// session verification and policy checks. No client may read or write.
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

V1 allowed client reads of public and member data as a "second line of defence". V2 removes them because no client reads exist, and an unused read rule is attack surface with no benefit. A future feature that needs live client listeners (e.g. real-time chat) must add a narrowly scoped rule plus tests, and update this document.

### 7.2 Storage: deny all clients
```
rules_version = '2';
// Uploads use short-lived V4 signed URLs issued by the server after
// policy checks; downloads of private media use signed GET URLs; public
// media is served from the public bucket. No Firebase client access.
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```
Signed URLs are authorised by IAM, not by these rules. The public bucket grants `allUsers: objectViewer` via IAM, uniform bucket-level access, and no listing.

### 7.3 Where authorization actually happens
| Layer | Enforces |
|---|---|
| `proxy.ts` | Session cookie present for private routes (UX redirect only, not security) |
| `getActor()` | Valid, unrevoked session; claims |
| `policy.can()` | Role × action × loaded resource (`ARCHITECTURE_V2.md` §5.3) |
| Tenant repos | Paths built only from `actor.bid` |
| Client-link service | Token hash lookup, `status == "active"`, not expired, target ∈ scope, same `business_id` |
| Signed URL issuance | Policy check per media item; 10–15 min expiry; content type and size constraints signed |

### 7.4 Rules and policy tests (CI)
- Rules: for a sample doc in **every** collection in §2, an unauthenticated client, a signed-in client and a client with forged custom claims are all denied read and write.
- Policy: a table-driven test enumerates every (role, action) pair from the matrix and asserts the decision. Resource checks are tested for field users: an unassigned project gives "not found".
- Tenant isolation: integration tests (as in V1) prove a member of business A cannot address any document of business B through any service, using ids from B.
- Client link: a token for business A cannot read or act on a quote, project or review of business A outside its scope, or anything of business B.

---

## 8. Data lifecycle

| Data | Retention |
|---|---|
| Notifications | TTL 90 days |
| Invitations | TTL 14 days |
| Rate limits | TTL = window + 1 h |
| Client links | Expire 180 days after project completion; revocable any time |
| Deleted business | Soft delete, purged after 30 days (all subcollections, posts, slug, storage prefixes) |
| Deleted user | Purged after 30 days; actor names in activity replaced with "Former member" |
| Exports | Object lifecycle 7 days |
| Incoming uploads | Object lifecycle 1 day |
| Backups | Daily export, 30 days (`ARCHITECTURE_V2.md` §12) |

---

## 9. Changes from V1

| V1 | V2 | Reason |
|---|---|---|
| Session reads `users`, `business`, `members` each request | Custom claims; 0 reads | Read cost and latency (audit D12) |
| Role `owner` \| `member` (member sees all) | `owner` \| `admin` \| `field` with assigned-only scoping | Spec requirement (audit C.2.7) |
| ISO string timestamps; UTC "today" | `Timestamp` for instants; local date strings in business timezone | TTL support; fixes overdue bug (audit C.2.3) |
| Money as numbers, `$` hardcoded | Minor units + currency; business default currency and tax | Audit C.2.4 |
| `quote_requests` subcollection + `users/*/quote_requests` copy | `leads.request` (single record) | Remove duplicate writes; no customer accounts needed |
| `notes` subcollection | `activity` with `type: "note"` | One timeline query |
| `photos` subcollection, private files streamed by `/media` | `media` registry + processing pipeline + signed URLs | Audit D3, D5 |
| `events` (one doc per view), analytics reads ≤ 50k | `stats/{yyyy-mm}` counters | Audit D2 |
| `posts.business.region_id` (nested) | `posts.region_id` (flattened) + missing combined index added | Audit C.1.1 |
| `businesses` filters `is_public` + `is_suspended` | Single computed `is_listed` | Fewer index fields, one source of truth |
| Name search: load 500 businesses, filter in memory | `search_tokens` + `rank`, indexed and paginated | Audit D12 |
| Likes, comments, followers, following | Dropped | Strategy: not in V2 |
| Lead stages: 7 | 5 | Simplicity |
| `reports` without index | Index 37 | Audit C.1.1 |
| Rules allow some client reads | Deny all | No client access exists |
| Public images via tokenised download URLs that survive post deletion | Public bucket objects deleted with the post | Audit C.2.6 |
| — (new) | `quotes`, `invoices`, `payments`, `updates`, `reviews`, `client_links`, `private/config`, `stats`, `exports`, `devices`, `blocks`, `admin_audit`, `rate_limits` | Strategy features 3–18 |

---

## 10. As implemented (core contractor workflow)

Where the shipped code differs from the plan above, the code is the source of truth and this table records why.

| Planned | Implemented | Why |
|---|---|---|
| `leads.next_follow_up_at` (Timestamp) | `leads.next_follow_up` (`YYYY-MM-DD`, business timezone) | A follow-up is a calendar day, not an instant; matches task due dates and the Today schedule. Set to `null` when a lead closes |
| Lead status `quoted` | `quote_sent` (label "Quoted") | Keeps V1 values; quotes are not built yet |
| `leads.customer` snapshot map | `leads.customer_id` + `customer_name` | V1 field names; synced by `updateCustomer` |
| Customer `stage` | `customers.status`: `prospect` → `active` → `past` (+ manual `inactive`) | Set automatically by `refreshCustomerStatus` (lib/data/workflow.ts) when jobs start, finish or are deleted |
| — | `customers.phone_digits`, `email_lower`; `leads.phone_digits` | Find-or-create matching: the same person asking twice (any phone format) stays one customer |
| `updates` collection | `activity` entries with `action: "update"`, `body`, `media[]` | One timeline query per record; photos also registered in `media` with `update_id` = the activity id |
| `media.variants`, processing Function | Single re-encoded WebP per photo (sharp, in the action); PDFs stored as-is | Functions not deployed yet; metadata is still stripped |
| `projects.member_ids` only | + `projects.responsible_id` (always in `member_ids`) and `projects.next_task` copy | Answers "who's responsible" and "what's next" on lists without extra reads; `next_task` owner: `refreshNextTask` |
| `activity.actor` map | `actor_id`, `actor_name` (+ `customer_id`, `lead_id`, `project_id`, `body`, `media`) | V1 field names; every entry carries all records it belongs to |
| `notes` collection (V1) | Removed; notes are `activity` entries with `action: "note"` | Single history |
| `photos` collection (V1) | Removed; `media` with `kind: "image" | "file"` | Photos and documents in one registry |

New indexes for this: activity by `lead_id`/`customer_id`/`project_id` + `created_at desc`, activity by record + `action` (note clean-up), `media (project_id, created_at desc)`, `leads (status, created_at desc)`, `tasks (project_id, status)`.

### Discovery and trust layer

| Planned | Implemented | Why |
|---|---|---|
| `reviews` keyed by auto id | `businesses/{bid}/reviews/{projectId}`: `rating`, `body`, `reviewer_name` ("First L."), `service_name`, `job_completed_on`, `status` (`published` \| `hidden`), `reply {body, at}` | One review per completed job by construction; editable by the customer for 14 days |
| Review invite by email/SMS code | `review_requests/{sha256(token)}`: `business_id`, `project_id`, customer snapshot, `expires_at` (+60 days), `used_at`; the job keeps `review_token`, `review_requested_at` | A capability link the contractor sends on WhatsApp; customers need no account. Only the hash is stored |
| Rating computed on read | `businesses.review_count`, `rating_sum` (transaction with the review); copied to `posts.business.rating` | Profile, cards and feed show ratings with no extra reads. Hiding a review via a report subtracts it |
| — | `businesses.response {count, total_minutes}`; `leads.first_response_at` | "Usually replies within …": the first time a new enquiry is moved on (status change or job started). Shown after 2 replies |
| — | `posts.verified_job`, `posts.completed_on` | A post linked to a completed job; job photos are copied from private `project-files/` to `public-media/` when published |
| `followers`, `likes`, `comments` | Removed. `users/{uid}/saves/{postId}` and `users/{uid}/following/{businessId}` (shown as "Saved contractors") are private shortlists | Discovery, trust and leads only: no public vanity counts |
| — | `leads.reference_post_id`; description line "Saw your work: …" | "Request a similar job" tells the contractor which work brought the customer |

New index: `reviews (status, created_at desc)`; `reviews.body` exempt from indexing. Stats events: `save`, `contact_click`, `review` (removed `like`, `comment`, `follow`).

## 11. Open schema questions

1. **Tax rules:** is GCT applied per line or per quote in practice, and are there exempt items? The schema supports per-line rates; the UI can default to one rate.
2. **Quote acceptance evidence:** is "typed name + timestamp + IP hash" sufficient for contractors in Jamaica, or is an email/SMS one-time code needed? (Legal review.)
3. **Review moderation:** should reviews publish immediately (`published`) or wait (`pending`)? Default: publish immediately, auto-hold reviews containing links or flagged words.
4. **Play UGC requirements:** confirm whether `users/*/blocks` plus report flows meet the current policy for user-generated content and user-to-user messaging. **[verify]**
5. **Customer data rights:** customers are not users, but their personal data is stored by contractors. Confirm with counsel who the data controller is and how a customer requests deletion. This affects whether customer deletion needs a platform-level workflow.
