import { initializeApp, getApps } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth, inMemoryPersistence, initializeAuth, type Auth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const isNew = getApps().length === 0;
const app = isNew ? initializeApp(firebaseConfig) : getApps()[0];
export const db = getDatabase(app);

// 입장권(커스텀 토큰)은 화면마다 새로 받는다 → 탭끼리 로그인 상태를 공유하지 않게 메모리에만 둔다
let authInstance: Auth | null = null;
export function firebaseAuth(): Auth {
  if (authInstance) return authInstance;
  try {
    authInstance = initializeAuth(app, { persistence: inMemoryPersistence });
  } catch {
    authInstance = getAuth(app); // 이미 초기화된 경우 (개발 중 새로고침)
  }
  return authInstance;
}
