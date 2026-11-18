// 로그인하고 돌아갈 곳. 우리 사이트의 정해진 화면만 허용한다.
const ALLOWED = [
  /^\/r\/[A-Z0-9]{6}(\/fanfare\/\d+|\/map)?$/,
  /^\/birthday-gacha\/g\/[A-Z0-9]{6}$/,
  /^\/birthday-gacha\/(admin|map)$/,
];

export function safeNextPath(next: string | null | undefined): string {
  if (next && ALLOWED.some((re) => re.test(next))) return next;
  return "/";
}
