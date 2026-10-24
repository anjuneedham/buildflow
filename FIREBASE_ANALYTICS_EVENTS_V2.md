# BuildFlow — Analytics Events (V2)

**Status:** planned, not implemented. No analytics SDK is installed, and adding one is a product and privacy decision (consent banner, privacy-policy update, measurement ID from the live project). The table maps each requested event to the exact server action where it would fire. All of them fire server-side, after the action succeeds, so client tampering cannot fake them.

| Event | Fires when | Source (server action) | Params (no PII) |
|---|---|---|---|
| sign_up | account created | auth signup action | method |
| login | session cookie issued | session route | method |
| onboarding_completed | final onboarding step saved | onboarding actions | account_type |
| business_created | business doc created | onboarding / business create | trade, location_id |
| profile_completed | business profile reaches all required fields | business settings action | — |
| contractor_viewed | public profile rendered | `/pro/[slug]` page | business_id |
| lead_created | customer sends quote request | quote request action | business_id, service_id |
| lead_received | lead written to business | same transaction | business_id |
| customer_created | contractor adds customer | customers action | business_id |
| project_created | job created | projects action | business_id |
| project_completed | job status → completed | projects status action | business_id |
| message_started | **blocked**: messages not built (product decision) | — | — |
| post_created | post published | posts action | business_id |
| subscription_started | Play Billing purchase verified | billing (not yet live) | plan_id |

## Recommended implementation (after approval)
1. Add a server helper `track(event, params)` that sends events to the GA4 Measurement Protocol, using `GA4_MEASUREMENT_ID` and `GA4_API_SECRET`. Both are server-only env vars. The helper does nothing when they are unset.
2. Add the client `gtag` only for page views, and only after consent.
3. Never send emails, names, phone numbers or free text as parameters.
