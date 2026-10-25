# BuildFlow — Firebase Production Checklist (V2)

Legend: [x] done and verified · [ ] to do · (L) needs access to the live project

## Project
- [ ] (L) Confirm that `build-6fa95` is the intended project; check its name and its Blaze plan (Storage needs Blaze for new buckets)
- [ ] Decide whether production is `build-6fa95` or `buildflow-prod`, and fix `.firebaserc`
- [ ] Record the Firestore region in the repo docs

## Auth
- [x] Email/password flows, reset, verification, logout revocation and deletion (emulator)
- [ ] (L) Enable the Email/Password provider
- [ ] (L) Add the Vercel domain to authorised domains
- [ ] (L) Set the email template sender name to "BuildFlow" and use the support address

## Firestore & Storage
- [x] Deny-all client rules, tested
- [x] Index file covers every query
- [ ] (L) `firebase deploy --only firestore:rules,firestore:indexes,storage --project build-6fa95` (**needs your approval**)
- [ ] (L) Confirm in the console that indexes are "Enabled"
- [ ] (L) Turn on daily backups / PITR for Firestore
- [x] (L) **Seed the reference data on every new project, before anyone signs up:** `npm run seed -- --reference` (14 trades, Jamaica and its parishes, the Basic plan; additive and safe to re-run). Without it onboarding step 3 shows no services and new contractors cannot continue. Done on `build-6fa95` on 25 Oct 2026; **repeat for `buildflow-prod`**.

## Vercel env (Production)
- [ ] `NEXT_PUBLIC_FIREBASE_*` (5 values from the web app config)
- [ ] `FIREBASE_SERVICE_ACCOUNT_KEY` (server only; never `NEXT_PUBLIC_`)
- [ ] No `*_EMULATOR_HOST` / `NEXT_PUBLIC_USE_FIREBASE_EMULATORS` vars
- [ ] Legal and support vars (see `src/lib/env.ts`); the build fails without them

## Android
- [x] Debug and signed release bundles build
- [ ] Upload keystore (kept outside git), version code, and `CAP_SERVER_URL` set to the production URL
- [ ] Closed-test blockers: Play Billing not implemented; Data safety form; privacy policy URL; account-deletion URL (`/delete-account` exists)

## Not required now
- Cloud Functions, FCM, App Check, Crashlytics: see the audit for reasons
- Analytics: waiting on a decision (`FIREBASE_ANALYTICS_EVENTS_V2.md`)
