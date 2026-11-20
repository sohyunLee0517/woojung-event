// 바나나 장부 (Neon).
//   · 지갑(uk_banana_wallets)은 잔액 한 줄, 장부(uk_banana_ledger)는 들어오고 나간 기록.
//   · 게임 보상은 '정산'할 때 준다: 내가 참여해서 끝난 게임 중 아직 안 받은 판을 찾아 참여·승리 바나나를 넣는다.
//     게임 코드(핀볼·과자·…)는 바나나를 몰라도 된다. 같은 판은 장부의 유일 키 때문에 두 번 받지 않는다.
//   · 지갑을 바꾸는 일은 모두 한 문장(CTE)으로 해서 장부와 잔액이 어긋나지 않는다.
import { getSql } from "@/lib/db";
import { BANANA_START, BANANAS_PER_PLAY, BANANAS_PER_WIN, gameRewards } from "./rules";

export async function bananaBalance(me: string): Promise<number> {
  const rows = (await getSql()`select balance from uk_banana_wallets where kakao_id = ${me}`) as { balance: number }[];
  return rows[0] ? Number(rows[0].balance) : 0;
}

/** 장부에 줄을 넣고(이미 있으면 건너뜀) 실제로 넣은 만큼 지갑에 더한다 */
async function credit(me: string, rows: { reason: string; delta: number }[], refId: number | null) {
  if (rows.length === 0) return 0;
  const deltas = rows.map((r) => r.delta);
  const reasons = rows.map((r) => r.reason);
  const out = (await getSql()`
    with ins as (
      insert into uk_banana_ledger (kakao_id, delta, reason, ref_id)
      select ${me}, t.d, t.r, ${refId}::bigint from unnest(${deltas}::int[], ${reasons}::text[]) as t(d, r)
      on conflict do nothing
      returning delta
    )
    insert into uk_banana_wallets (kakao_id, balance)
    select ${me}, coalesce(sum(delta), 0)::int from ins
    on conflict (kakao_id) do update set balance = uk_banana_wallets.balance + excluded.balance, updated_at = now()
    returning (select coalesce(sum(delta), 0)::int from ins) as added
  `) as { added: number }[];
  return Number(out[0]?.added ?? 0);
}

/** 관리자·테스트용으로 바나나를 그냥 준다 */
export async function grantBananas(me: string, n: number, _note = "grant") {
  return credit(me, [{ reason: "grant", delta: n }], null);
}

// 끝난 게임마다 참여자·승리 여부·끝난 시각 (모든 사람).
//   승리 기준: 핀볼 1등 / 가챠 1등 / 과자·해적 팀 성공 / 우정의 온도 100도 달성 / AI 게임 승자 또는 팀 성공
const PARTICIPATIONS = `
  with parts as (
    select m.kakao_id, g.id as game_id, coalesce(pg.result_order[1] = m.kakao_id, false) as won, g.ended_at
    from uk_room_games g join uk_pinball_games pg on pg.game_id = g.id
      cross join lateral unnest(pg.members) as m(kakao_id)
    where g.game_type = 'pinball' and g.status = 'ended' and coalesce(g.outcome, 'completed') = 'completed'
    union all
    select m.kakao_id, g.id, sg.status = 'success', g.ended_at
    from uk_room_games g join uk_snack_games sg on sg.game_id = g.id
      cross join lateral unnest(sg.members) as m(kakao_id)
    where g.game_type = 'snack' and sg.status in ('success', 'fail')
    union all
    select pp.kakao_id, g.id, pg.status = 'success', g.ended_at
    from uk_room_games g join uk_pirate_games pg on pg.game_id = g.id
      join uk_pirate_players pp on pp.game_id = g.id
    where g.game_type = 'pirate' and pg.status in ('success', 'fail')
    union all
    select gp.kakao_id, g.id, true, g.ended_at
    from uk_room_games g join uk_game_participants gp on gp.game_id = g.id
    where g.game_type = 'fanfare' and g.status = 'ended' and coalesce(g.outcome, 'completed') = 'completed'
    union all
    select m.kakao_id, g.id, coalesce(r.team_success, false) or m.kakao_id = any(coalesce(r.winners, '{}')), r.ended_at
    from uk_room_games g join uk_ai_rounds r on r.game_id = g.id
      cross join lateral unnest(r.members) as m(kakao_id)
    where g.game_type = 'ai' and r.ended_at is not null
    union all
    select gp.kakao_id, g.id,
           not exists (select 1 from game_players o where o.game_code = g.ref_code
                       and (o.money > gp.money or (o.money = gp.money and o.minutes > gp.minutes))),
           (select max(c.drawn_at) from capsules c where c.game_code = g.ref_code)
    from uk_room_games g join game_players gp on gp.game_code = g.ref_code
    where g.game_type = 'gacha'
      and exists (select 1 from capsules c where c.game_code = g.ref_code)
      and not exists (select 1 from capsules c where c.game_code = g.ref_code and c.drawn_by is null)
  )
`;

/** 이 판 바나나를 이미 받았는지 (평소 정산 play 또는 소급 정산 retro_play) */
const NOT_PAID = `not exists (select 1 from uk_banana_ledger l where l.kakao_id = p.kakao_id and l.reason in ('play', 'retro_play') and l.ref_id = p.game_id)`;

/** 내가 참여해서 (기능을 연 뒤) 끝난 게임 중 아직 안 받은 판을 정산한다. 새로 받은 바나나 수를 돌려준다. */
export async function settleBananas(me: string): Promise<number> {
  const games = (await getSql().query(
    `${PARTICIPATIONS} select p.game_id::bigint as id, p.won from parts p
     where p.kakao_id = $1 and p.ended_at >= $2::timestamptz and ${NOT_PAID}`,
    [me, BANANA_START],
  )) as { id: number; won: boolean }[];
  let added = 0;
  for (const g of games) added += await credit(me, gameRewards(g.won), Number(g.id));
  return added;
}

export type RetroRow = { kakaoId: string; nickname: string | null; games: number; wins: number; bananas: number };

/** 소급 정산 계획 (기능 전에 끝난 게임, 샘플·탈퇴 계정 제외). 아무것도 바꾸지 않는다 */
export async function retroBananaPlan(): Promise<RetroRow[]> {
  const rows = (await getSql().query(
    `${PARTICIPATIONS}
     select p.kakao_id, pl.nickname, count(*)::int as games, count(*) filter (where p.won)::int as wins
     from parts p join players pl on pl.kakao_id = p.kakao_id
     where p.ended_at < $1::timestamptz and p.kakao_id not like 'sample-%' and pl.deleted_at is null and ${NOT_PAID}
     group by p.kakao_id, pl.nickname
     order by count(*) desc, p.kakao_id`,
    [BANANA_START],
  )) as { kakao_id: string; nickname: string | null; games: number; wins: number }[];
  return rows.map((r) => ({
    kakaoId: r.kakao_id,
    nickname: r.nickname,
    games: Number(r.games),
    wins: Number(r.wins),
    bananas: Number(r.games) * BANANAS_PER_PLAY + Number(r.wins) * BANANAS_PER_WIN,
  }));
}

/** 소급 정산 실행 (게임마다 한 번만, 사유 retro_play / retro_win). only 를 주면 그 사람들만 */
export async function applyRetroBananas(only?: string[]): Promise<number> {
  const rows = (await getSql().query(
    `${PARTICIPATIONS}
     select p.kakao_id, p.game_id::bigint as id, p.won
     from parts p join players pl on pl.kakao_id = p.kakao_id
     where p.ended_at < $1::timestamptz and p.kakao_id not like 'sample-%' and pl.deleted_at is null and ${NOT_PAID}
       and ($2::text[] is null or p.kakao_id = any($2::text[]))`,
    [BANANA_START, only ?? null],
  )) as { kakao_id: string; id: number; won: boolean }[];
  let added = 0;
  for (const r of rows) {
    const rewards = gameRewards(r.won).map((x) => ({ reason: x.reason === "play" ? "retro_play" : "retro_win", delta: x.delta }));
    added += await credit(r.kakao_id, rewards, Number(r.id));
  }
  return added;
}

/** 정산하고 잔액 */
export async function myBananas(me: string): Promise<number> {
  await settleBananas(me);
  return bananaBalance(me);
}

export type SpendResult = { ok: true; ledgerId: number } | { ok: false; balance: number };

/** n개 쓰기. 잔액이 모자라면 아무것도 안 바뀐다 (동시에 눌러도 한 번만 빠진다) */
export async function spendBananas(me: string, n: number): Promise<SpendResult> {
  const rows = (await getSql()`
    with w as (
      update uk_banana_wallets set balance = balance - ${n}, updated_at = now()
      where kakao_id = ${me} and balance >= ${n}
      returning kakao_id
    )
    insert into uk_banana_ledger (kakao_id, delta, reason)
    select kakao_id, ${-n}, 'prompt' from w
    returning id
  `) as { id: number }[];
  if (rows[0]) return { ok: true, ledgerId: Number(rows[0].id) };
  return { ok: false, balance: await bananaBalance(me) };
}

/** 쓴 바나나 되돌리기 (AI가 게임을 못 만들었을 때). 같은 줄은 한 번만 */
export async function refundBananas(me: string, ledgerId: number) {
  await getSql()`
    with p as (
      select delta from uk_banana_ledger where id = ${ledgerId} and kakao_id = ${me} and reason = 'prompt'
    ), ins as (
      insert into uk_banana_ledger (kakao_id, delta, reason, ref_id)
      select ${me}, -p.delta, 'refund', ${ledgerId} from p
      on conflict do nothing
      returning delta
    )
    update uk_banana_wallets set balance = balance + (select coalesce(sum(delta), 0) from ins), updated_at = now()
    where kakao_id = ${me}
  `;
}
