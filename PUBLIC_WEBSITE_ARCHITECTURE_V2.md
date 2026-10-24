# BuildFlow Public Website Architecture V2

Status: **proposal for approval.** Nothing here has been built by this pass. The public site already exists and mostly works; this document says what it is for, what is missing, and how it should be organised so it stays separate in purpose from the web app but shares one product and one codebase. See `WEB_APP_ARCHITECTURE_V2.md` for the app and `VERCEL_DEPLOYMENT_V2.md` for hosting.

## 1. Purpose: three jobs, different from the app's one

| Surface | Job | Reader | Success looks like |
|---|---|---|---|
| **Marketing** (home, features, for contractors, for customers, pricing, about, FAQ, support, legal) | Explain BuildFlow and get someone to start | A contractor deciding whether to try it; a customer wondering if it is safe | Contractor starts a trial; customer opens Explore |
| **Discovery** (Explore, contractor profiles, posts) | Let customers find and trust a contractor, and let the contractor be found | A customer comparing contractors; a search engine | A quote request (a lead) |
| **Web app** (`/app`) | Run the business | A signed-in contractor | Jobs delivered, customers kept |

Marketing is **static, fast, indexable and read-only**. Discovery is **public, cacheable and the main source of organic traffic**, because every contractor profile and portfolio post is a real, unique, locally relevant page. The app is **private, dynamic and never indexed**. Keeping those three apart (layout, rendering, caching, analytics) is the architecture; they are not three codebases.

## 2. Site map and status

| Page | Route | Status | Rendering | Index? |
|---|---|---|---|---|
| Home | `/` | ✅ | Static | yes |
| Features | `/features` | ✅ | Static | yes |
| For Contractors | `/for-contractors` | ✅ | Static | yes |
| For Customers | `/for-customers` | ✅ | Static | yes |
| Pricing | `/pricing` | ✅ | Static, refreshed hourly and on plan edits | yes |
| Explore / Discover | `/explore` | ✅ | Dynamic today; **ISR planned** | yes |
| Explore by service and area | `/explore/[service]/[area]` | ✗ new | ISR | yes (the main SEO landing pages) |
| Contractor profile | `/contractor/[slug]` | ✅ | Dynamic today; **ISR planned** | yes |
| Post | `/post/[id]` | ✅ | Dynamic today; **ISR planned** | yes |
| Search | `/search` | ✅ | Static, hourly | yes |
| About | `/about` | ✅ | Static | yes |
| Contact | `/contact` | ✅ | Static | yes |
| **FAQ** | `/faq` | ✗ **new** | Static | yes |
| **Support** | `/support` | ✗ **new** | Static | yes |
| Privacy Policy | `/privacy` | ✅ | Static | yes |
| Terms of Service | `/terms` | ✅ | Static | yes |
| Refund policy | `/refund-policy` | ✅ | Static | yes |
| Sign up, log in, reset | `/signup`, `/login`, `/forgot-password` | ✅ | App shell | no |
| Review link, invite link | `/review/[token]`, `/invite/[token]` | ✅ | Dynamic | **no** |
| Client link (future) | `/c/[token]` | ✗ | Dynamic | **no** |

Only two pages are missing from your list: **FAQ** and **Support**. Support is currently only "Contact".

## 3. Structure

```
src/app/
  (marketing)/   home, features, for-*, pricing, about, faq, support, contact, privacy, terms, refund-policy
                 layout: MarketingHeader + SiteFooter. No session read. Static.
  (discover)/    explore, explore/[service]/[area], search, contractor/[slug], post/[id]
                 layout: light header with search, SiteFooter. ISR; viewer state fetched client-side.
  (auth)/        login, signup, forgot-password, auth/action
  (app)/         app/**, onboarding, account, saved      (workspace shell, never indexed)
  review/, invite/ , c/                                   (capability links, noindex, no header chrome)
```

- **Today** these are `(site)` and `(auth)`. The change is a rename plus splitting one layout into two. Do it route by route, with the existing e2e and QA suites as the safety net.
- **One design system** (`src/components/ui`, the tokens in `DESIGN_SYSTEM_V2.md`) is used by all groups. Marketing gets its own *section* components (hero, feature rows, pricing card, FAQ accordion, CTA band) in `src/components/marketing`; they must not import anything from `/app` code (an ESLint boundary rule enforces it).
- **Header state:** the static header shows "Log in / Get started" or "Dashboard / account" using the non-sensitive `bf_auth` hint cookie and `/api/me`, so marketing pages stay static. That mechanism exists and works.
- **Content:** the pages are TSX with copy inline. That is right for a small, engineer-owned site. If non-engineers need to edit copy, add MDX files in the repository first (still static, reviewed in pull requests) and a headless CMS only if that is not enough. Pricing already reads from the `plans` collection, so price changes need no deploy.

## 4. SEO

**Already in place:** per-page `<title>` template and descriptions, Open Graph and Twitter card defaults, canonical URLs on profiles and Explore, `sitemap.xml` (static pages plus every public contractor, hourly), `robots.txt`, JSON-LD (LocalBusiness with `aggregateRating`) on profiles, `noindex` on capability links.

**To add:**

1. **Programmatic landing pages** `/explore/[service]/[area]` (for example "electricians in Kingston"): 14 parishes × the service list gives a few hundred pages, each backed by real contractors and work. Statically generate the top combinations, ISR the rest, and **return 404 or `noindex` for empty combinations** so the site never publishes thin pages. Include them in the sitemap only when they have at least one contractor.
2. **ISR for profiles and posts** with tag revalidation (the page is generated once, served from the CDN, and refreshed when the contractor edits). Today every profile view runs a function and reads Firestore because the page reads the session cookie. This is both the biggest SEO win (faster, cacheable HTML) and the biggest cost lever on Vercel.
3. **Open Graph images** generated per profile and per post (`opengraph-image.tsx`), because the links are shared on WhatsApp, where the preview is the pitch.
4. **Structured data:** `FAQPage` on `/faq`, `Organization` and `WebSite` (with SearchAction) on the home page, `Review` snippets already covered by `aggregateRating`.
5. **Robots:** add `/review`, `/media` and `/c` to the disallow list (the review page already sends `noindex`, so this is belt and braces).
6. **Sitemap:** split into static, contractors and posts when it passes a few thousand URLs; add `lastModified` to static pages.
7. **Internal linking:** footer links to the service pages, parish pages from Explore, "more work by" on posts (exists).
8. **Core Web Vitals:** LCP image priority on the first card, explicit image dimensions, smaller photo variants (about 800 px) with `srcset`. Public pages currently weigh about 200 KB before photos.

## 5. Page specifications for the two new pages

**FAQ (`/faq`).** Static. Grouped: *Getting started* (what is BuildFlow, who is it for, is it free for customers, how long is the trial), *Pricing and billing* (per-user pricing, cancelling, refunds), *Customers* (how to request a quote, who sees my details, how reviews are verified, how to report a problem), *Contractors* (importing customers, team roles, who owns the data, exporting it, what "Verified job" and "Verified by BuildFlow" mean), *Privacy and safety*. Accordion component with a real `<details>` fallback, `FAQPage` JSON-LD, each answer under 80 words, and a "Still need help?" link to Support. Answers about verification must match what the product actually proves (`QA_REPORT_V2.md` O1): do not claim more than a link-based review proves.

**Support (`/support`).** Static. Three blocks: *Contact us* (support email and WhatsApp business number from configuration, expected reply time), *Common fixes* (reset password, verify email, can't upload a photo, a customer never got my WhatsApp), and *Report a problem* (the existing report flow for posts, reviews and businesses; a form posting to a `support_requests` collection later). Until a help desk exists, a `mailto:` plus WhatsApp link is enough; do not add a third-party widget yet.

## 6. Conversion paths (marketing → product)

- **Contractor:** every marketing page ends in one primary action, `/signup?type=contractor` ("Start 14-day free trial"), carried through to onboarding. Pricing shows the seat calculator. Secondary: "See a demo profile" → the demo contractor.
- **Customer:** `For Customers` → Explore. Profile and post pages carry "Request a quote" and "Request a similar job" (built). Customer sign-up is optional; the quote form works without an account.
- **Measurement without extra infrastructure:** profile views, quote requests, contact clicks, saves and reviews are already counted per contractor in Firestore. For marketing funnels (visit → sign-up → first lead → first job), add privacy-friendly events after consent; Firebase Analytics (GA4) or Vercel Web Analytics both work on Vercel **[verify consent requirements for Jamaica and for the audience]**.

## 7. Relationship to the web app (what must stay different)

| | Public website | Web app |
|---|---|---|
| Rendering | Static / ISR, CDN | Dynamic, per user |
| Session | Never read on the server | Required |
| Layout | Header, hero sections, footer | Workspace shell (bottom bar, sidebar) |
| Indexing | Yes | Never (robots, `noindex`, auth) |
| Analytics | Consent-based funnels | First-party business counters |
| Tone | Persuasive, plain language, local | Task-first, terse |
| Shared | Tokens, components, logo, copy for plans | |

Never duplicate a feature across them. The marketing site must not embed app screens that read data; use screenshots or the demo profile.

## 8. Accessibility, legal, performance

- WCAG 2.1 AA: the existing audit (axe) on key pages stays in CI; add the new pages to the audit URL list. FAQ accordions are keyboard operable; skip link exists.
- **Legal:** Privacy, Terms and Refund pages exist. Before launch they need review by counsel against the actual data flows (customer details held by contractors, reviews, analytics) and Jamaica's Data Protection Act 2020 **[verify with counsel]**. Add a cookie and analytics consent banner only when analytics is added. Link Privacy and Terms from the sign-up form (done).
- **Budgets:** under 250 KB first-load JavaScript per public route, LCP under 2.5 s on a throttled mid-range Android profile, zero layout shift from images. Measured today without photos: about 200 KB per page, 4.6–5.2 s on an emulated 400 kbps connection; photos are the remaining cost.

## 9. Implementation steps (after approval)

1. Add `/faq` and `/support`, wire them into the header, footer and sitemap, add them to `tests/qa/layouts.mjs` and the audit list. (Half a day.)
2. Robots and sitemap fixes (§4.5, §4.6). (Under an hour.)
3. Introduce the `(marketing)` and `(discover)` groups and split the layout; move routes one at a time with the e2e suites green after each. (One to two days.)
4. ISR for profile, post and Explore, with the viewer-state endpoint and tag revalidation on publish and profile edit. (Two to three days; needs the session read moved out of these pages.)
5. `/explore/[service]/[area]` landing pages with empty-combination handling. (One day.)
6. Open Graph images and structured data. (One day.)
7. Photo variants and `srcset`. (Pairs with the direct-to-Storage upload work.)
8. Consent banner and analytics, when you decide on a tool.

Steps 1–2 are safe, small and need no architecture decision; I can do them as soon as you say so.
