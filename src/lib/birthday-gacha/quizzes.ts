// 뽑기권 퀴즈 문제 은행. 서버에서만 정답을 본다.
// 친구들 관련 문제로 바꾸거나 더 넣으려면 아래 배열에 같은 모양으로 추가하면 된다.

export type Quiz = {
  id: string;
  question: string;
  choices: [string, string, string, string];
  /** choices 안에서 정답 위치 (0~3) */
  answer: 0 | 1 | 2 | 3;
};

export const QUIZZES: Quiz[] = [
  {
    id: "glico",
    question: "달리는 남자 '글리코 간판'이 있는 곳은?",
    choices: ["우메다", "도톤보리", "덴노지", "난바파크스"],
    answer: 1,
  },
  {
    id: "yen10000",
    question: "2024년에 바뀐 새 1만 엔 지폐의 인물은?",
    choices: ["후쿠자와 유키치", "노구치 히데요", "시부사와 에이이치", "쓰다 우메코"],
    answer: 2,
  },
  {
    id: "yen5000",
    question: "새 5천 엔 지폐의 인물은?",
    choices: ["쓰다 우메코", "히구치 이치요", "기타사토 시바사부로", "나쓰메 소세키"],
    answer: 0,
  },
  {
    id: "yen1000",
    question: "새 1천 엔 지폐의 인물은?",
    choices: ["노구치 히데요", "기타사토 시바사부로", "이토 히로부미", "시부사와 에이이치"],
    answer: 1,
  },
  {
    id: "takoyaki",
    question: "오사카 명물 타코야키에 들어가는 주재료는?",
    choices: ["오징어", "새우", "문어", "게살"],
    answer: 2,
  },
  {
    id: "ookini",
    question: "오사카 사투리로 '고마워'는?",
    choices: ["오오키니", "난데야넨", "메챠쿠챠", "보치보치"],
    answer: 0,
  },
  {
    id: "donpen",
    question: "돈키호테 마스코트 펭귄의 이름은?",
    choices: ["펜펜", "돈펜", "키호펜", "돈짱"],
    answer: 1,
  },
  {
    id: "escalator",
    question: "오사카에서는 에스컬레이터 어느 쪽에 서는 게 보통일까?",
    choices: ["왼쪽", "오른쪽", "가운데", "아무 데나"],
    answer: 1,
  },
  {
    id: "kushikatsu",
    question: "쿠시카츠 가게에서 절대 하면 안 되는 것은?",
    choices: ["손으로 먹기", "양배추 리필", "소스 두 번 찍기", "맥주 주문"],
    answer: 2,
  },
  {
    id: "osakajo",
    question: "오사카성을 처음 지은 인물은?",
    choices: ["도쿠가와 이에야스", "오다 노부나가", "도요토미 히데요시", "다케다 신겐"],
    answer: 2,
  },
];

export function findQuiz(id: string) {
  return QUIZZES.find((q) => q.id === id) ?? null;
}

/** 화면에 내려줄 때는 정답을 뺀다 */
export function publicQuiz(q: Quiz) {
  return { id: q.id, question: q.question, choices: q.choices };
}
