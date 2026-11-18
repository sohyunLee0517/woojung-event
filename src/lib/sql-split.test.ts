import { describe, expect, it } from "vitest";
import { splitSqlStatements } from "../../scripts/sql-split.mjs";

describe("splitSqlStatements (schema.sql 을 한 문장씩 나누기)", () => {
  it("; 로 나누고 주석·빈 문장은 버린다", () => {
    expect(splitSqlStatements("-- 설명\ncreate table a (x int);\n\n; select 1 -- 끝\n")).toEqual([
      "create table a (x int)",
      "select 1",
    ]);
  });

  it("$$ 로 감싼 함수 본문 안의 ; 는 나누지 않는다", () => {
    const fn = "create or replace function f() returns int language plpgsql as $$\nbegin\n  return 1;\nend;\n$$";
    expect(splitSqlStatements(`${fn};\nselect 2;`)).toEqual([fn, "select 2"]);
  });

  it("문자열 안의 ; 와 -- 는 건드리지 않는다", () => {
    expect(splitSqlStatements("select 'a;b' as x; select '--no' as y;")).toEqual([
      "select 'a;b' as x",
      "select '--no' as y",
    ]);
  });
});
