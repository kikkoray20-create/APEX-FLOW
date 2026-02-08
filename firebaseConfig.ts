
import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

/**
 * 🛰️ APEXFLOW SECURE CLOUD BRIDGE
 * This module connects the app to Firebase Firestore.
 */

// Defensive helper to get environment variables without crashing
const getSafeEnv = (key: string): string => {
  try {
    // Check Vite's import.meta.env
    const viteEnv = (import.meta as any).env;
    if (viteEnv && viteEnv[key]) return viteEnv[key];
    
    // Check Node-style process.env (rare in browser but some polyfills use it)
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return process.env[key] as string;
    }

    // Check window global (fallback if you inject keys via script tag)
    if (typeof window !== 'undefined' && (window as any)._APP_CONFIG && (window as any)._APP_CONFIG[key]) {
      return (window as any)._APP_CONFIG[key];
    }
  } catch (e) {
    // Fail silently
  }
  return "";
};

const firebaseConfig = {
  apiKey: getSafeEnv('AIzaSyBVXl_YA5xY03BjSeehrbSb3-9d6_ngsd4'),
  authDomain: getSafeEnv('apexflow-b43da.firebaseapp.com'),
  projectId: getSafeEnv('apexflow-b43da'),
  storageBucket: getSafeEnv('apexflow-b43da.firebasestorage.app'),
  messagingSenderId: getSafeEnv('669291481874'),
  appId: getSafeEnv('1:669291481874:web:8732388638dfbded1dc1cb'),
  measurementId: getSafeEnv('G-RJSC9JE04H')
};

// Basal connectivity check
const isConfigValid = !!firebaseConfig.projectId && !!firebaseConfig.apiKey;

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
    console.warn("⚠️ Firebase Configuration Missing. Check GitHub Secrets and Workflow Environment mapping.");
}

export { db, auth, isCloudActive };
