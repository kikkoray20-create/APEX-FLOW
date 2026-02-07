
import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

/**
 * 🛰️ APEXFLOW SECURE CLOUD BRIDGE
 * This module connects the app to Firebase Firestore.
 */

// Safely access Vite environment variables. 
// Optional chaining (?.) prevents crashes if import.meta.env is not defined in the browser.
// Fix: Added casting to any to resolve "Property 'env' does not exist on type 'ImportMeta'" TypeScript errors
const meta = import.meta as any;
const firebaseConfig = {
  apiKey: (meta.env?.VITE_FIREBASE_API_KEY as string) || "",
  authDomain: (meta.env?.VITE_FIREBASE_AUTH_DOMAIN as string) || "",
  projectId: (meta.env?.VITE_FIREBASE_PROJECT_ID as string) || "",
  storageBucket: (meta.env?.VITE_FIREBASE_STORAGE_BUCKET as string) || "",
  messagingSenderId: (meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID as string) || "",
  appId: (meta.env?.VITE_FIREBASE_APP_ID as string) || "",
  measurementId: (meta.env?.VITE_FIREBASE_MEASUREMENT_ID as string) || ""
};

// Check if Project ID is present as a baseline for connectivity
const isConfigValid = !!firebaseConfig.projectId;

let db: any = null;
let auth: any = null;
let isCloudActive = false;

if (isConfigValid) {
    try {
        const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
        db = getFirestore(app);
        auth = getAuth(app);
        isCloudActive = true;
        console.log("✅ ApexFlow Cloud Node Connected Successfully.");
    } catch (error) {
        console.error("❌ Firebase Initialization Error:", error);
    }
} else {
    console.warn("⚠️ Firebase Configuration Missing or Incomplete. Working in Local-Only Mode.");
}

export { db, auth, isCloudActive };
