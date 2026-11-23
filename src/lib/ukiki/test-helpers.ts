// DB 테스트 전용 도우미
import { getSql } from "@/lib/db";

/** 준비완료 → 3·2·1 을 건너뛰고 가챠를 바로 시작된 상태로 만든다 */
export async function startGachaNow(code: string) {
  await getSql()`update games set started_at = now() - interval '1 second' where code = ${code}`;
}

/** 대기 제한 시간이 지난 것으로 만든다 (게임을 연 시각을 10분 전으로) */
export async function waitOver(gameId: number) {
  await getSql()`update uk_room_games set created_at = now() - interval '10 minutes' where id = ${gameId}`;
}
