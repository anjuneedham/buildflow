"use client";

import { getApps, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, inMemoryPersistence, setPersistence } from "firebase/auth";
import { env, firebaseConfig } from "@/lib/env";

// The browser SDK is used only for Firebase Auth. The ID token is exchanged
// for an httpOnly session cookie and the client copy is discarded, so all
// data access happens on the server.
export function clientAuth() {
  const app = getApps()[0] ?? initializeApp(firebaseConfig);
  const auth = getAuth(app);
  if (env.useEmulators && !(auth as unknown as { _emu?: boolean })._emu) {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    (auth as unknown as { _emu?: boolean })._emu = true;
  }
  void setPersistence(auth, inMemoryPersistence);
  return auth;
}
