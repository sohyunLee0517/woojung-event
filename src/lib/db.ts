import { neon } from "@neondatabase/serverless";

let client: ReturnType<typeof neon> | null = null;

// DATABASE_URL(Neon 연결 문자열)로 쿼리 함수를 만든다. 처음 쓸 때 한 번만 만든다.
export function getSql() {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL 이 설정되지 않았습니다.");
    client = neon(url);
  }
  return client;
}
