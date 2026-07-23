
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc, onSnapshot, enableIndexedDbPersistence } from "firebase/firestore";
import { Workspace } from "../types";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || ""
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Enable Offline Persistence
// This allows the app to load instantly from cache and sync when online.
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code == 'failed-precondition') {
    console.warn('Firebase Persistence: Multiple tabs open, persistence disabled');
  } else if (err.code == 'unimplemented') {
    console.warn('Firebase Persistence: Browser not supported');
  }
});

const DB_COLLECTION = "app_data";
const DB_DOC_ID = "main_workspace";

export const saveWorkspacesToFirestore = async (workspaces: Workspace[]) => {
  try {
    const docRef = doc(db, DB_COLLECTION, DB_DOC_ID);
    // Overwrite document with new state
    await setDoc(docRef, { workspaces, lastUpdated: new Date().toISOString() }, { merge: true });
  } catch (e) {
    console.error("Error saving document: ", e);
  }
};

export const loadWorkspacesFromFirestore = async (): Promise<Workspace[] | null> => {
  try {
    const docRef = doc(db, DB_COLLECTION, DB_DOC_ID);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return docSnap.data().workspaces as Workspace[];
    } else {
      return null;
    }
  } catch (e) {
    console.error("Error loading document: ", e);
    return null;
  }
};

export const subscribeToWorkspaces = (callback: (ws: Workspace[]) => void) => {
  const docRef = doc(db, DB_COLLECTION, DB_DOC_ID);
  return onSnapshot(docRef, (doc) => {
    if (doc.exists()) {
      callback(doc.data().workspaces as Workspace[]);
    }
  });
};
