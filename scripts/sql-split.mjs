// schema.sql 을 Neon HTTP 로 한 문장씩 실행하려고 나눈다.
// 문자열('...')과 $$ 함수 본문 안의 ; 와 -- 는 건드리지 않는다.
export function splitSqlStatements(text) {
  const out = [];
  let cur = "";
  let i = 0;
  let mode = "code"; // code | string | dollar | comment
  while (i < text.length) {
    const ch = text[i];
    const two = text.slice(i, i + 2);
    if (mode === "code") {
      if (two === "--") {
        mode = "comment";
        i += 2;
        continue;
      }
      if (two === "$$") {
        mode = "dollar";
        cur += two;
        i += 2;
        continue;
      }
      if (ch === "'") mode = "string";
      if (ch === ";") {
        if (cur.trim()) out.push(cur.trim());
        cur = "";
        i++;
        continue;
      }
      cur += ch;
      i++;
    } else if (mode === "comment") {
      if (ch === "\n") {
        mode = "code";
        cur += ch;
      }
      i++;
    } else if (mode === "string") {
      cur += ch;
      if (ch === "'") mode = "code";
      i++;
    } else {
      if (two === "$$") {
        mode = "code";
        cur += two;
        i += 2;
        continue;
      }
      cur += ch;
      i++;
    }
  }
  if (cur.trim()) out.push(cur.trim());
  return out.map((s) => s.replace(/[ \t]+$/gm, "").trim());
}
