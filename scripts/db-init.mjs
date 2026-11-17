// 사용법: npm run db:init  (.env.local 의 DATABASE_URL 에 테이블을 만든다)
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL 이 없습니다. .env.local 을 확인하세요.");
  process.exit(1);
}

const sql = neon(url);
const schema = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
// Neon HTTP 는 한 번에 한 문장만 실행하므로 ; 기준으로 나눠 실행한다.
const statements = schema
  .split(";")
  .map((s) => s.replace(/--.*$/gm, "").trim())
  .filter(Boolean);
for (const statement of statements) await sql.query(statement);
const rows = await sql.query("select count(*)::int as count from players");
console.log(`players 테이블 준비 완료 (현재 ${rows[0].count}명)`);
