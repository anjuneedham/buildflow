# Google Play Closed Test Checklist (V2)

Status as of 24 October 2026. **Verified** = checked against the actual build or service. **Unverified** = not testable from the build environment. **You** = a step only the account owner can do.

## 1. The build

| Item | Value | Status |
|---|---|---|
| App type | Capacitor 8 shell loading the hosted web app (`mobile/`). No business logic in the Android code | Verified |
| Package / application ID | `com.buildflow.app` (permanent after the first upload) | Verified in the merged manifest. **You: confirm before uploading** |
| App name | BuildFlow | Verified |
| Version name / code | `1.0.0` / `1` (set with `ANDROID_VERSION_NAME` / `ANDROID_VERSION_CODE`; the code must rise with every upload) | Verified |
| Target / min SDK | 36 / 24 | Verified |
| Hosted app address baked in | `https://buildflow-app-beta.vercel.app` (HTTPS only, navigation restricted to that host) | Verified in the bundle's `capacitor.config.json` |
| Release bundle | `mobile/android/app/build/outputs/bundle/release/app-release.aab` (about 3.0 MB). Build output is not committed; rebuild with the commands in `mobile/README.md` | Built and signed |
| Debug APK (for sideloading) | `app/build/outputs/apk/debug/app-debug.apk` | Built |
| Debug flags | WebView debugging off, logging off, `allowBackup=false`, cleartext traffic off | Verified |

## 2. Signing

- An **upload key** was generated on 24 October 2026: RSA 4096, alias `buildflow-upload`, owner `CN=Andrew Needham, O=YardScale Digital, C=JM`, valid 10,000 days.
- Upload certificate SHA-256: `EF:34:5E:1F:86:48:BA:37:35:F2:38:3C:70:E7:53:31:EA:97:84:4F:AC:A2:97:9E:1C:BE:EC:A8:70:4D:29:73`
- The keystore and its passwords were handed to the owner. They are **not** in this repository (`*.jks`, `*.keystore` and `keystore.properties` are gitignored).
- **You:** store the key and passwords somewhere durable, and enrol in **Play App Signing** on the first upload so Google holds the app signing key and can reset a lost upload key.

## 3. Permissions

| Permission | Why |
|---|---|
| `INTERNET` | Loads the hosted app |
| `com.buildflow.app.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` | Added automatically by AndroidX; internal, not shown to users |

No camera, storage, location, contacts or notification permissions. Photo uploads use the system picker.

## 4. Backend status (Firebase project `build-6fa95`)

| Service | Status |
|---|---|
| Firestore: deny-all client rules and 29 composite indexes deployed; live read/write/query/delete tested | Verified |
| Authentication: Email/Password enabled; a live account was created, read back and deleted | Verified |
| Storage | **Not set up.** Needs the Blaze plan. Until then, logo, portfolio and site-photo uploads fail on the live app. Reminder set for 31 October 2026 |
| Cloud Messaging (push) | Not built. No push notifications; new leads appear in the in-app Inbox only |
| Analytics | No third-party analytics. First-party counters only |
| Crashlytics | Not applicable to the shell; Play Console's Android vitals reports native crashes |
| App Check | Not configured. All data access is server-side, so it is not required for the closed test |

`build-6fa95` is the **staging** project. A separate production project is still to be created before public launch.

## 5. Hosting

- Vercel project `buildflow-app` (team `yardscale-digital`), deployed from branch `claude/buildflow-v1`.
- Public address `https://buildflow-app-beta.vercel.app` returns 200 without a Vercel login (verified). Other `*.vercel.app` addresses for the project stay behind Vercel deployment protection.
- The Vercel Hobby plan is for non-commercial use. **You:** move to Pro before charging customers.

## 6. Policy and privacy

| Requirement | Status |
|---|---|
| Privacy policy URL | `https://buildflow-app-beta.vercel.app/privacy` (live). Operator: Andrew Needham, trading as YardScale Digital, Independence City, St. Catherine, Jamaica; governing law Jamaica; contact yardscaledigital@gmail.com |
| Legal review | **Not done.** Pages show a "not reviewed by a lawyer" banner. **You:** get them reviewed |
| Account deletion, in app and at a public URL | Built: Account → Delete my account, and `/delete-account` |
| User-generated content | Report button on posts, reviews and businesses; admin review queue |
| Target audience | 18+ |
| Ads | None |

**Data safety form (draft, check before submitting):** collected: name, email, phone number, photos, user-generated content (posts, reviews), customer details a contractor enters, app interactions (first-party counters), location as typed text (not device location). Not collected: device location, contacts, advertising ID, financial data (no payments yet). Shared with service providers acting for us: Google Firebase, Vercel. Encrypted in transit: yes. Users can request deletion: yes. No data sold.

## 7. Store listing (You)

- [ ] App icon, 512 × 512 PNG (source art: `mobile/assets/icon-only.png`)
- [ ] Feature graphic, 1024 × 500 PNG or JPG
- [ ] Phone screenshots (at least 2); add 7-inch and 10-inch tablet screenshots if you list tablet support
- [ ] Short description (80 characters) and full description (4,000 characters)
- [ ] Category, contact email, privacy policy URL
- [ ] Content rating questionnaire (user-generated content: yes)
- [ ] Data safety form (section 6)
- [ ] Reviewer test account with sample data, credentials entered in Play Console

## 8. Testers (You)

- New personal developer accounts must run a closed test with a minimum number of testers for a minimum period before applying for production. The figure commonly cited is 12 testers for 14 days. **Confirm the current numbers in Play Console.**
- Add testers by email list or Google Group.

## 9. Not yet tested

- The app has **not** been run on a real device. Install the debug APK on an Android device and check: sign-up and login, the photo picker (fails until Storage is set up), opening a PDF, WhatsApp and phone links, the back button, the offline page (airplane mode), and layout on Android 15+.
- Subscriptions: none. The 14-day trial never expires, and Play Billing is not integrated. The closed test does not require billing.

## 10. Suggested release notes (1.0.0)

> First closed test of BuildFlow. Manage leads, customers, jobs and tasks; publish finished work; let customers find you and request quotes. Photo uploads are temporarily unavailable. Payments are not active, and every account is on a free trial.
