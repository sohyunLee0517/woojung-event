// 바나나 소급 정산 실행 (게임마다 한 번만, 다시 돌려도 중복 지급 없음). 실행: npm run bananas:retro-apply
// 먼저 npm run bananas:retro-plan 으로 사람별 수량을 보고 승인받은 뒤에 돌린다.
import { applyRetroBananas } from "@/lib/bananas/store";

console.log(`소급 정산으로 바나나 ${await applyRetroBananas()}개를 넣었어요.`);
