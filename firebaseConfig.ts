import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

/**
 * 🛰️ APEXFLOW SECURE CLOUD BRIDGE
 */

const getSafeEnv = () => {
    try {
        const viteEnv = (import.meta as any).env;
        if (viteEnv) return viteEnv;
    } catch (e) {}
    return {};
};

const env = getSafeEnv();

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID
};

// Check if all essential keys are present
const isConfigActive = !!firebaseConfig.apiKey && 
                      firebaseConfig.apiKey !== "undefined" && 
                      firebaseConfig.apiKey !== "";

let db: any = null;
let auth: any = null;
let isCloudActive = false;

if (isConfigActive) {
    try {
        // Use modular initialization
        const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
        db = getFirestore(app);
        auth = getAuth(app);
        isCloudActive = true;
        console.log("✅ ApexFlow Cloud Node Connected.");
    } catch (error) {
        console.error("❌ Firebase Initialization Error:", error);
    }
} else {
    console.warn("⚠️ Firebase Keys missing. Running in Local Storage Mode.");
}

export { db, auth, isCloudActive };