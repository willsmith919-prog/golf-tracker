import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyB8u4N8yPT9VJejYCgfT_v_FSGohCghr1M",
  authDomain: "livelinks-cf018.firebaseapp.com",
  databaseURL: "https://livelinks-cf018-default-rtdb.firebaseio.com",
  projectId: "livelinks-cf018",
  storageBucket: "livelinks-cf018.firebasestorage.app",
  messagingSenderId: "658641708649",
  appId: "1:658641708649:web:620bd1327d75c3678424f8"
};

const app = initializeApp(firebaseConfig);
export const database = getDatabase(app);
export const auth = getAuth(app);