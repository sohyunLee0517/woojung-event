// 사용법: npm run rules:deploy  (database.rules.json 을 Firebase 실시간 DB 에 게시)
import { readFileSync } from "node:fs";
import { cert, initializeApp } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";

const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT 가 없어요 (.env.local)");
const sa = JSON.parse(raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8"));
const app = initializeApp({
  credential: cert({ projectId: sa.project_id, clientEmail: sa.client_email, privateKey: sa.private_key }),
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
});
const db = getDatabase(app);
const before = await db.getRules();
console.log("기존 규칙:\n" + before);
await db.setRules(readFileSync("database.rules.json", "utf8"));
console.log("새 규칙을 게시했어요.");
process.exit(0);
