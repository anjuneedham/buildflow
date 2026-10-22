# Roadmap

## V1 (this release)
Auth · onboarding · public profiles · explore/search · posts/likes/comments/saves/follows · quote requests → leads · CRM · customers · projects & tasks · dashboard · basic analytics · notifications (in-app) · team basics · subscription architecture · admin basics · moderation · legal drafts.

## V1.1 — make it launchable
- Stripe Checkout + webhooks; enforce trial expiry; customer portal for cancellation
- Transactional email (quote requests, invites, verification branding) via Resend
- Legal review of privacy/terms/refund pages; real company details in `src/lib/legal.ts`
- Redis-backed rate limiting; error monitoring; uptime checks
- Pagination on leads/customers/projects; image resizing/compression

## V1.2 — conversion & trust
- Reviews & ratings on completed projects
- Verification flow (ID / business registration / insurance documents)
- Public project pages (indexable) and richer SEO landing pages ("Electricians in Kingston")
- Lead response-time tracking; "Your profile generated X quotes" weekly email

## V2 — run more of the business
- Estimates & invoices, payments
- Calendar / scheduling, crew availability
- Messaging between customer and contractor
- Project documents
- Push notifications
- Pro / Business / Enterprise plans (data-driven, no restructuring)

## V3 — platform
- Native iOS/Android (Expo) on the same Supabase backend
- Caribbean expansion (additional countries in `locations`), then global
- Acquisition/ROI analytics, marketplace features
