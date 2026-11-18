import { timingSafeEqual } from "node:crypto";

/** 예약 실행 요청이 `Authorization: Bearer <CRON_SECRET>` 를 정확히 갖고 왔는지 */
export function isCronAuthorized(header: string | null, secret: string | undefined): boolean {
  if (!secret || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const got = Buffer.from(header);
  return got.length === expected.length && timingSafeEqual(got, expected);
}

/** cron 식 '분 시 * * *' 의 시 칸을 실제 시(0~23) 목록으로 펼친다. (*, a-b, a-b/n, 쉼표 지원) */
export function cronHoursUtc(expr: string): number[] {
  const hourField = expr.trim().split(/\s+/)[1] ?? "*";
  const hours = new Set<number>();
  for (const part of hourField.split(",")) {
    const [range, stepRaw] = part.split("/");
    const step = stepRaw ? Number(stepRaw) : 1;
    let [from, to] = [0, 23];
    if (range !== "*") {
      const [a, b] = range.split("-").map(Number);
      from = a;
      to = b ?? (stepRaw ? 23 : a);
    }
    for (let h = from; h <= to; h += step) hours.add(h);
  }
  return [...hours].sort((a, b) => a - b);
}
