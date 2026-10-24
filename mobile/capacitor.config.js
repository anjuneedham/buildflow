// Android shell for BuildFlow. It loads the hosted web app (server.url), so there is one codebase and one backend:
// every rule (permissions, validation, deletion) lives in the web app, and a web deploy updates the app for everyone.
//
// Set the address when syncing or building:   CAP_SERVER_URL=https://<your-vercel-domain> npm run sync
const url = process.env.CAP_SERVER_URL;
if (!url || !/^https:\/\//.test(url)) throw new Error("Set CAP_SERVER_URL to the https address of the hosted BuildFlow web app, for example https://buildflow.vercel.app");
const host = new URL(url).host;

module.exports = {
  // The application id is permanent once an app is published on Google Play: confirm it before the first upload.
  appId: "com.buildflow.app",
  appName: "BuildFlow",
  webDir: "www", // only the offline fallback page; the app itself is remote
  server: {
    url,
    cleartext: false,
    errorPath: "offline.html", // shown instead of a blank screen when the server cannot be reached
    allowNavigation: [host],   // everything else (WhatsApp, phone, maps, other sites) opens outside the app
  },
  android: {
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
  },
  loggingBehavior: "none",
};
