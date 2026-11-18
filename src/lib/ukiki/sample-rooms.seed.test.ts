import { describe, expect, it } from "vitest";
import { getSql } from "@/lib/db";
import { drawCapsule, joinGame } from "@/lib/birthday-gacha/games";
import { createFanfare, createGachaInRoom, createRoom, endFanfare, enterRoom, joinFanfare } from "./rooms";

// 로비 구경용 샘플 방 만들기/지우기 (실제 앱 함수로 만든다)
//   만들기: npm run seed:sample
//   지우기: npm run seed:clean
// 샘플 친구 kakao_id 는 모두 sample- 로 시작한다.
const MODE = process.env.SAMPLE_MODE;

const FRIENDS = [
  ["sample-01", "지은"],
  ["sample-02", "민수"],
  ["sample-03", "하늘"],
  ["sample-04", "도윤"],
  ["sample-05", "서연"],
  ["sample-06", "지호"],
  ["sample-07", "수아"],
  ["sample-08", "예준"],
  ["sample-09", "하린"],
  ["sample-10", "은우"],
] as const;

// [방 이름, 비밀방?, 진행 중(빵빠레/가챠), 지난 게임 수]
const ROOMS: [string, boolean, ("fanfare" | "gacha")[], number][] = [
  ["주말 보드게임 모임", false, ["fanfare"], 2],
  ["회사 동기 넷", true, ["gacha"], 1],
  ["대학 동아리 OB", false, [], 3],
  ["제주 여행 준비방", false, ["gacha"], 0],
  ["5월 생일 파티", true, ["fanfare", "gacha"], 1],
  ["헬스장 메이트", false, [], 0],
  ["고딩 삼총사", true, [], 2],
  ["맛집 탐방대", false, ["fanfare"], 0],
  ["독서 모임 책벌레", false, [], 1],
  ["캠핑 가자", false, ["gacha"], 0],
  ["러닝 크루 새벽반", true, ["fanfare"], 1],
  ["반려견 산책 친구들", false, [], 0],
  ["게임 디스코드 사람들", false, ["gacha"], 2],
  ["오사카 먹방 투어", true, [], 0],
  ["사내 풋살 팀", false, ["fanfare"], 1],
  ["필라테스 동기", false, [], 0],
  ["동네 육아 품앗이", true, ["gacha"], 0],
  ["영화 덕후 모임", false, [], 3],
  ["코딩 스터디 3기", false, ["fanfare"], 0],
  ["사진 출사 모임", false, [], 1],
  ["와인 한 잔 할까", true, [], 0],
  ["등산 동호회 정상", false, ["gacha"], 1],
  ["수능 끝난 우리", false, [], 0],
  ["뜨개질 하는 밤", false, ["fanfare"], 0],
  ["군대 동기 휴가방", true, [], 1],
];

// 더보기가 나오도록 게임 없는 공개방을 더 만든다
const EXTRA = [
  "퇴근 후 한 판", "점심 메뉴 정하기", "코인노래방 가자", "야구 직관 메이트", "피아노 학원 친구들",
  "스터디카페 지박령", "넷플 같이 봐요", "주식 말고 적금", "다이어트 챌린지", "아침형 인간 되기",
  "베이킹 클래스", "볼링 치는 사람", "방탈출 고수들", "낚시 갈 사람", "크리스마스 파티",
  "송년회 준비위", "신입생 환영회", "졸업 여행 가자", "자취생 반찬 공유", "우리 동네 고양이",
];

async function cleanSamples() {
  const sql = getSql();
  const ids = FRIENDS.map(([id]) => id);
  await sql`delete from uk_rooms where owner_kakao_id = any(${ids})`;
  await sql`delete from games where host_kakao_id = any(${ids})`;
  await sql`delete from players where kakao_id = any(${ids})`;
}

describe.skipIf(!process.env.DATABASE_URL || !MODE)("샘플 방", () => {
  it(
    MODE === "clean" ? "샘플 방 지우기" : "샘플 방 만들기",
    async () => {
      await cleanSamples();
      if (MODE === "clean") return;

      const sql = getSql();
      for (const [id, name] of FRIENDS) {
        await sql`insert into players (kakao_id, nickname) values (${id}, ${name}) on conflict do nothing`;
      }

      let made = 0;
      for (const [i, [name, secret, active, pastCount]] of ROOMS.entries()) {
        const owner = FRIENDS[i % FRIENDS.length][0];
        const room = await createRoom(owner, { name, visibility: secret ? "private" : "public", password: "1234" });
        if (!room.ok) throw new Error(room.error);
        made++;
        // 멤버 2~4명
        const members = [owner, ...FRIENDS.filter(([id]) => id !== owner).slice(i % 5, (i % 5) + 1 + (i % 3)).map(([id]) => id)];
        for (const m of members.slice(1)) await enterRoom(room.code, m, "1234");

        // 지난 게임: 빵빠레는 열고 참여 후 끝, 가챠는 3명이 다 뽑기
        for (let k = 0; k < pastCount; k++) {
          if (k % 2 === 0 || members.length < 3) {
            const f = await createFanfare(room.code, members[k % members.length]);
            if (f.kind === "created") {
              for (const m of members) await joinFanfare(room.code, f.id, m);
              await endFanfare(room.code, f.id, members[k % members.length]);
            }
          } else {
            const g = await createGachaInRoom(room.code, members[0]);
            if (!g) continue;
            const players = members.slice(0, 3);
            for (const p of players.slice(1)) await joinGame(g, p);
            for (let d = 0; d < 3; d++) for (const p of players) await drawCapsule(g, p);
          }
        }

        // 진행 중인 게임
        if (active.includes("fanfare")) {
          const f = await createFanfare(room.code, members[members.length - 1]);
          if (f.kind === "created") for (const m of members) await joinFanfare(room.code, f.id, m);
        }
        if (active.includes("gacha")) {
          const g = await createGachaInRoom(room.code, members[0]);
          if (g && members[1]) {
            await joinGame(g, members[1]);
            await drawCapsule(g, members[0]);
          }
        }
      }
      for (const [i, name] of EXTRA.entries()) {
        const owner = FRIENDS[(i + 3) % FRIENDS.length][0];
        const room = await createRoom(owner, { name, visibility: i % 4 === 0 ? "private" : "public", password: "1234" });
        if (room.ok) made++;
      }
      expect(made).toBe(ROOMS.length + EXTRA.length);
    },
    300_000,
  );
});
