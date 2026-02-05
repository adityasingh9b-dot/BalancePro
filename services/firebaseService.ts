import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, onValue, remove } from "firebase/database";
import { getAuth } from "firebase/auth";
import { getStorage, ref as sRef, getDownloadURL } from "firebase/storage"; // Add this

const firebaseConfig = {
  apiKey: "AIzaSyDa1GaljBFsHo3OYli-PRJp_UEcQDim8Rs",
  authDomain: "balancepro-d97b0.firebaseapp.com",
  projectId: "balancepro-d97b0",
  storageBucket: "balancepro-d97b0.firebasestorage.app",
  messagingSenderId: "692888451123",
  appId: "1:692888451123:web:a0ab5a34a24299bb1e0b46",
  measurementId: "G-YKPBQTB77X",
  databaseURL: "https://balancepro-d97b0-default-rtdb.firebaseio.com"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);
export const storage = getStorage(app); // Export storage

// Helper functions for common tasks
export const startLiveClass = (meetingId: string, trainerName: string) => {
  return set(ref(db, 'active_class'), {
    meetingId,
    trainerName,
    status: 'live',
    timestamp: Date.now()
  });
};

export const endLiveClass = () => {
  return remove(ref(db, 'active_class'));
};
