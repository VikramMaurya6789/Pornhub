// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCwQsAbhISOliso3848I4Gm2RGjtpwMhww",
  authDomain: "orangehub-29955.firebaseapp.com",
  projectId: "orangehub-29955",
  storageBucket: "orangehub-29955.firebasestorage.app",
  messagingSenderId: "592360204706",
  appId: "1:592360204706:web:a38cb4e468010416182afb",
  measurementId: "G-TQ1R7MB7PW"
};

// Initialize Firebase safely (avoid multiple initializations during HMR/SSR)
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

let analytics = null;

export const initAnalytics = async () => {
  if (typeof window !== "undefined" && !analytics) {
    try {
      const supported = await isSupported();
      if (supported) {
        analytics = getAnalytics(app);
      }
    } catch (e) {
      console.warn("[Firebase Analytics] init skipped:", e.message);
    }
  }
  return analytics;
};

export { app, analytics };
