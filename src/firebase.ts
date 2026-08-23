import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import appletConfig from "../firebase-applet-config.json";

// Your web app's Firebase configuration.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || appletConfig.apiKey || "AIzaSyC0aQvNi5whi1vpFMgR6DJwfLeVPWR3OPE",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || appletConfig.authDomain || "omega-exchange-mxctm.firebaseapp.com",
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || appletConfig.projectId || "omega-exchange-mxctm",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || appletConfig.storageBucket || "omega-exchange-mxctm.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || appletConfig.messagingSenderId || "37565147035",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || appletConfig.appId || "1:37565147035:web:a8113400f7b8f01f39233e",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || appletConfig.measurementId || "",
};

export const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

let _auth = null;
export function getFirebaseAuth() {
  if (!_auth) _auth = getAuth(app);
  return _auth;
}

// Persistent local (IndexedDB) cache: on repeat visits, onSnapshot listeners
// resolve from the on-device cache first — instantly, no network round trip —
// then reconcile with the server in the background. This is what actually
// cuts perceived MCQ loading time on return visits; previously every open of
// the Manage MCQs / Add MCQ screens re-fetched everything over the network
// from a cold start, even for data that hadn't changed since last time.
// persistentMultipleTabManager lets multiple open tabs share one cache instead
// of fighting over it. Wrapped in try/catch because initializeFirestore()
// throws if Firestore was already initialized for this app (e.g. hot reload
// in dev, or a second import) — falling back to the plain getFirestore()
// instance in that case is harmless.
export let db;
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
} catch {
  db = getFirestore(app);
}
export const functions = getFunctions(app);

// Analytics only works in a real browser (not SSR / not this build step), and some
// ad-blockers or privacy modes will throw when it tries to initialize — so it's
// loaded lazily and failures are swallowed rather than crashing the app.
export async function initAnalytics() {
  if (typeof window === "undefined") return null;
  try {
    const { getAnalytics, isSupported } = await import("firebase/analytics");
    if (await isSupported()) {
      return getAnalytics(app);
    }
  } catch {
    // analytics is non-critical — ignore failures (blocked script, unsupported env, etc.)
  }
  return null;
}
