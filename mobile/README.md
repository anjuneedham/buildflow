# BuildFlow Android shell

A Capacitor app that loads the hosted BuildFlow web app. There is no business logic here: permissions, validation, uploads and account deletion all live in the web app, and a web deploy updates the Android app for everyone.

## Build

Needs JDK 21, the Android SDK (platform 36, build-tools 36) and Node 22.

```bash
cd mobile && npm install
export ANDROID_HOME=/path/to/android-sdk
export CAP_SERVER_URL=https://<the hosted BuildFlow address>   # required, https only
cd android
./gradlew assembleDebug      # app/build/outputs/apk/debug/app-debug.apk
./gradlew bundleRelease      # app/build/outputs/bundle/release/app-release.aab
```

`bundleRelease` is signed only if `android/keystore.properties` exists (never commit it):

```
storeFile=/path/to/upload-key.jks
storePassword=...
keyAlias=...
keyPassword=...
```

Set `ANDROID_VERSION_CODE` (an integer that must rise with every upload) and `ANDROID_VERSION_NAME` when building. Regenerate icons with `node scripts/make-android-assets.mjs && npx capacitor-assets generate --android`.

## Before the first Play upload

- **Application id** `com.buildflow.app` is permanent once published. Confirm it.
- The `CAP_SERVER_URL` is baked into the bundle. Build against the real address.
- Create the **upload key** and keep it safe; enrol in Play App Signing.
- Test on a real phone (nothing here has been run on a device): sign-in, camera and gallery photo picker, opening a PDF, WhatsApp and phone links, back button, offline page, the edge-to-edge layout on Android 15+.
