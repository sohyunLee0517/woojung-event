import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { createFirebaseCustomToken } from "@/lib/firebase-token";
import { getDatabase } from "firebase-admin/database";

// 서버 전용 Firebase 관리자. FIREBASE_SERVICE_ACCOUNT 에 서비스 계정 JSON(그대로 또는 base64)을 넣는다.
function serviceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  const text = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
  return JSON.parse(text) as { project_id: string; client_email: string; private_key: string };
}

let app: App | null = null;
function adminApp(): App | null {
  if (app) return app;
  const sa = serviceAccount();
  if (!sa) return null;
  app =
    getApps().find((a) => a.name === "ukiki-admin") ??
    initializeApp(
      {
        credential: cert({ projectId: sa.project_id, clientEmail: sa.client_email, privateKey: sa.private_key }),
        databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
      },
      "ukiki-admin",
    );
  return app;
}

export function firebaseAdminReady() {
  return adminApp() !== null;
}

/**
 * 빵빠레 입장권 발급: 호스트·멤버 명단(meta)을 서버가 써 두고, 카카오 ID 로 커스텀 토큰을 만든다.
 * 규칙(database.rules.json)은 이 meta 를 보고 누가 무엇을 쓸 수 있는지 정한다.
 */
export async function issueFanfareToken(gameId: number, hostKakaoId: string, uid: string) {
  const a = adminApp();
  if (!a) throw new Error("FIREBASE_SERVICE_ACCOUNT 가 없어요");
  const db = getDatabase(a);
  await db.ref(`ukiki/fanfare/${gameId}/meta`).update({ hostId: hostKakaoId, [`members/${uid}`]: true });
  return createFirebaseCustomToken(serviceAccount()!, uid);
}

/** 게임이 끝나면 실시간 데이터를 지운다 (서버에서) */
export async function clearFanfareRealtime(gameId: number) {
  const a = adminApp();
  if (!a) return;
  await getDatabase(a).ref(`ukiki/fanfare/${gameId}`).remove();
}
