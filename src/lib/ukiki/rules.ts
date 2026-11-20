import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// 우끼끼(우리끼리) 방 규칙. DB 없이 테스트할 수 있는 순수 함수만 둔다.

export type Visibility = "public" | "private";
export type GameType = "fanfare" | "gacha" | "pirate" | "snack" | "pinball" | "ai";

export const ROOM_NAME_MAX = 20;
export const ROOM_PASSWORD_MIN = 4;
export const ROOM_PASSWORD_MAX = 20;

type RoomInput = { name: string; visibility: string; password?: string | null };
type ValidRoom = { name: string; visibility: Visibility; password: string | null };

export function validateRoomInput(
  input: RoomInput,
): { ok: true; value: ValidRoom } | { ok: false; error: string } {
  const name = input.name.trim();
  if (!name) return { ok: false, error: "방 이름을 정해 주세요" };
  if ([...name].length > ROOM_NAME_MAX) return { ok: false, error: `방 이름은 ${ROOM_NAME_MAX}자까지예요` };
  if (input.visibility !== "public" && input.visibility !== "private") {
    return { ok: false, error: "공개/비공개를 골라 주세요" };
  }
  if (input.visibility === "public") return { ok: true, value: { name, visibility: "public", password: null } };

  const password = input.password ?? "";
  const len = [...password].length;
  if (len < ROOM_PASSWORD_MIN || len > ROOM_PASSWORD_MAX) {
    return { ok: false, error: `비밀번호를 ${ROOM_PASSWORD_MIN}~${ROOM_PASSWORD_MAX}자로 정해 주세요` };
  }
  return { ok: true, value: { name, visibility: "private", password } };
}

/** 비밀번호는 scrypt$소금$해시 형태로만 저장한다 */
export function hashRoomPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 32);
  return ["scrypt", salt.toString("base64"), hash.toString("base64")].join("$");
}

export function verifyRoomPassword(password: string, stored: string | null): boolean {
  if (!password || !stored) return false;
  const [scheme, saltB64, hashB64] = stored.split("$");
  if (scheme !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64");
  if (expected.length === 0) return false;
  const got = scryptSync(password, Buffer.from(saltB64, "base64"), expected.length);
  return got.length === expected.length && timingSafeEqual(got, expected);
}

export type RoomEntry = "enter" | "need_password" | "wrong_password";

export function roomEntry(input: {
  visibility: Visibility;
  passwordHash: string | null;
  isMember: boolean;
  password?: string;
}): RoomEntry {
  if (input.visibility === "public" || input.isMember) return "enter";
  if (input.password === undefined) return "need_password";
  return verifyRoomPassword(input.password, input.passwordHash) ? "enter" : "wrong_password";
}

export type ActiveFanfare = { id: number; hostKakaoId: string; hostName: string | null };

export type FanfareCreateOutcome =
  | { kind: "created"; id: number }
  | { kind: "conflict"; active: ActiveFanfare; message: string; choices: ("leave" | "join")[] }
  | { kind: "retry" };

/**
 * 방당 진행 중인 빵빠레는 1개.
 * 두 명이 동시에 빵빠레를 만들면 먼저 저장한 사람이 호스트가 되고,
 * 늦은 사람은 저장 순간에 '나가기 / 그 빵빠레 참여하기'를 고른다.
 */
export function fanfareCreateOutcome(input: {
  createdId: number | null;
  active: ActiveFanfare | null;
}): FanfareCreateOutcome {
  if (input.createdId !== null) return { kind: "created", id: input.createdId };
  if (!input.active) return { kind: "retry" };
  return {
    kind: "conflict",
    active: input.active,
    message: `${input.active.hostName ?? "다른 친구"}님이 먼저 우정의 온도를 열었어요`,
    choices: ["leave", "join"],
  };
}
