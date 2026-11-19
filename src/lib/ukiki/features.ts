// 피처 토글 (관리자 페이지에서 켜고 끈다). 행이 없으면 켜진 것으로 본다.
import { getSql } from "@/lib/db";
import type { GameType } from "@/lib/ukiki/rules";

export const GAME_TYPES: GameType[] = ["fanfare", "gacha", "pirate", "snack", "pinball"];
const gameKey = (t: GameType) => `game:${t}`;

export async function getFlags(keys: string[]): Promise<Record<string, boolean>> {
  const rows = (await getSql()`
    select key, enabled from uk_feature_flags where key = any(${keys})
  `) as { key: string; enabled: boolean }[];
  const out: Record<string, boolean> = {};
  for (const k of keys) out[k] = rows.find((r) => r.key === k)?.enabled ?? true;
  return out;
}

export async function setFlag(key: string, enabled: boolean, by: string) {
  await getSql()`
    insert into uk_feature_flags (key, enabled, updated_by) values (${key}, ${enabled}, ${by})
    on conflict (key) do update set enabled = excluded.enabled, updated_by = excluded.updated_by, updated_at = now()
  `;
}

/** 게임별로 켜져 있는지 */
export async function enabledGames(): Promise<Record<GameType, boolean>> {
  const flags = await getFlags(GAME_TYPES.map(gameKey));
  return Object.fromEntries(GAME_TYPES.map((t) => [t, flags[gameKey(t)]])) as Record<GameType, boolean>;
}

export async function setGameEnabled(type: GameType, enabled: boolean, by: string) {
  await setFlag(gameKey(type), enabled, by);
}
