import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyBhfCNteNxcpmS-ceSBKWaRtFNtW1fUc8M",
  authDomain: "danhba-5cd66.firebaseapp.com",
  projectId: "danhba-5cd66",
  storageBucket: "danhba-5cd66.firebasestorage.app",
  messagingSenderId: "217905239382",
  appId: "1:217905239382:web:968752f71e0e5c5ee6b2f7",
  measurementId: "G-8H2EVZVDQW"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const realtimeDb = getDatabase(app);

export { db, realtimeDb };