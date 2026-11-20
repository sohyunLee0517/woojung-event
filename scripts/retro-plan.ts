// 바나나 소급 정산 계획 보기 (아무것도 바꾸지 않는다). 실행: npm run bananas:retro-plan
import { retroBananaPlan } from "@/lib/bananas/store";

const rows = await retroBananaPlan();
console.table(rows.map((r) => ({ 이름: r.nickname ?? r.kakaoId, 판: r.games, 승리: r.wins, 바나나: r.bananas })));
console.log(`합계 ${rows.reduce((a, r) => a + r.bananas, 0)}개 · ${rows.length}명`);
