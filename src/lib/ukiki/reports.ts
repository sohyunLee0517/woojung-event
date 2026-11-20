// 앱 안 신고하기. 구글 플레이 아동 안전 표준(앱 안에서 신고 가능)을 위해 만든다.
// 신고는 관리자 페이지에서 확인하고, 아동 안전 신고는 관련 기관에도 알린다.
import { getSql } from "@/lib/db";
import { normalizeRoomCode } from "@/lib/ukiki/rooms";

export const REPORT_CATEGORIES = [
  { value: "child_safety", label: "아동 안전 (아동 성적 학대·착취 등)" },
  { value: "harassment", label: "괴롭힘·욕설" },
  { value: "privacy", label: "개인정보·위치 악용" },
  { value: "ai_game", label: "AI로 만든 게임이 이상해요 (폭력·선정·괴롭힘 등)" },
  { value: "other", label: "그 밖의 문제" },
] as const;

export type ReportCategory = (typeof REPORT_CATEGORIES)[number]["value"];
const MAX = 1000;

export async function createReport(
  reporter: string,
  input: { category: string; body: string; roomCode?: string | null; aiGameId?: number | null },
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!REPORT_CATEGORIES.some((c) => c.value === input.category)) return { ok: false, error: "신고 종류를 골라 주세요" };
  const body = (input.body ?? "").trim();
  if (!body) return { ok: false, error: "내용을 적어 주세요" };
  if (body.length > MAX) return { ok: false, error: `${MAX}자까지 적을 수 있어요` };
  const room = input.roomCode ? normalizeRoomCode(input.roomCode) : null;
  const aiGameId = Number.isInteger(input.aiGameId) && Number(input.aiGameId) > 0 ? Number(input.aiGameId) : null;
  await getSql()`
    insert into uk_reports (reporter_kakao_id, category, body, room_code, ai_game_id)
    values (${reporter}, ${input.category}, ${body}, ${room}, ${aiGameId})
  `;
  return { ok: true };
}

export async function listReports(limit = 50) {
  const rows = (await getSql()`
    select r.id, r.reporter_kakao_id, p.nickname, r.category, r.body, r.room_code, r.status, r.created_at, r.ai_game_id,
           ag.title as ai_title, ag.status as ai_status
    from uk_reports r left join players p on p.kakao_id = r.reporter_kakao_id
      left join uk_ai_games ag on ag.id = r.ai_game_id
    order by r.created_at desc, r.id desc
    limit ${limit}
  `) as {
    id: number;
    reporter_kakao_id: string;
    nickname: string | null;
    category: string;
    body: string;
    room_code: string | null;
    status: string;
    created_at: string;
    ai_game_id: number | null;
    ai_title: string | null;
    ai_status: string | null;
  }[];
  return rows.map((r) => ({
    id: Number(r.id),
    reporterKakaoId: r.reporter_kakao_id,
    reporterName: r.nickname,
    category: r.category,
    body: r.body,
    roomCode: r.room_code,
    status: r.status,
    createdAt: new Date(r.created_at).toISOString(),
    aiGameId: r.ai_game_id === null ? null : Number(r.ai_game_id),
    aiGameTitle: r.ai_title,
    aiGameHidden: r.ai_status === "hidden",
  }));
}
