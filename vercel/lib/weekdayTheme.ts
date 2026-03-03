export type WeekdayTheme = {
  weekday: string;
  category: string;
  guidance: string;
  example: string;
};

const THEMES: Record<number, WeekdayTheme> = {
  0: {
    weekday: "일요일",
    category: "대면 면접 관련",
    guidance: "대면 면접 답변 구성은 장면 중심으로 풀어내고, 상황-행동-결과가 보이게 작성한다.",
    example: "답변은 문장 나열보다 장면 설명 중심으로 쓴다.",
  },
  1: {
    weekday: "월요일",
    category: "면접 예상질문 관련",
    guidance: "면접 예상질문과 답변 방향을 짝으로 제시하고, 체력관리/스트레스관리/이미지메이킹 같은 실전 항목을 담는다.",
    example: "체력·스트레스·이미지메이킹 질문 대비 포인트를 제시한다.",
  },
  2: {
    weekday: "화요일",
    category: "대한항공 지원 비전공자 조언",
    guidance: "비전공자 시선에서 서비스 태도, 직무 적합성, 솔직한 학습 태도를 강조한다.",
    example: "전공보다 승무원다운 태도와 서비스 관점이 핵심이라는 메시지.",
  },
  3: {
    weekday: "수요일",
    category: "승무원 준비 꿀팁",
    guidance: "실행 가능한 준비 루틴 중심으로 작성하고 체력/질문의도 파악/기초 루틴을 포함한다.",
    example: "지금 시기에 집중할 준비 항목을 우선순위로 제시한다.",
  },
  4: {
    weekday: "목요일",
    category: "면접 관련",
    guidance: "면접관이 보는 포인트와 입실 태도, 시선, 긴장 관리 등 현장성 있는 팁을 담는다.",
    example: "표정 관리, 시선 처리, 모르는 질문 대응법 중심.",
  },
  5: {
    weekday: "금요일",
    category: "전직 승무원이 본 객실승무원 필요 역량",
    guidance: "팀워크, 글로벌 역량, 사회성, 침착함 등 핵심 역량을 실무 맥락으로 설명한다.",
    example: "기내 팀워크와 침착한 상황대처의 중요성.",
  },
  6: {
    weekday: "토요일",
    category: "영상면접 꿀팁",
    guidance: "영상면접 화면 구성, 비율, 표정/의상/헤어 조정 팁 등 카메라 기반 실전 팁을 다룬다.",
    example: "영상 프레임 안에서 균형감 있게 보이도록 조정하는 팁.",
  },
};

function weekdayKstFromDate(dateKst: string): number {
  const label = new Date(`${dateKst}T12:00:00+09:00`).toLocaleDateString("en-US", {
    weekday: "short",
    timeZone: "Asia/Seoul",
  });
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[label] ?? 0;
}

export function getWeekdayTheme(dateKst: string): WeekdayTheme {
  return THEMES[weekdayKstFromDate(dateKst)];
}

export function getWeekdayThemeTable(): Array<{ weekday: string; category: string; example: string }> {
  return [
    { weekday: "월요일", category: THEMES[1].category, example: THEMES[1].example },
    { weekday: "화요일", category: THEMES[2].category, example: THEMES[2].example },
    { weekday: "수요일", category: THEMES[3].category, example: THEMES[3].example },
    { weekday: "목요일", category: THEMES[4].category, example: THEMES[4].example },
    { weekday: "금요일", category: THEMES[5].category, example: THEMES[5].example },
    { weekday: "토요일", category: THEMES[6].category, example: THEMES[6].example },
    { weekday: "일요일", category: THEMES[0].category, example: THEMES[0].example },
  ];
}

export function getWeekdayThemePrompt(dateKst: string): string {
  const theme = getWeekdayTheme(dateKst);
  return [
    `요일 고정 규칙: ${theme.weekday} 카테고리는 반드시 "${theme.category}"로 작성한다.`,
    `작성 가이드: ${theme.guidance}`,
    `예시 톤 참고: ${theme.example}`,
    "다른 요일 카테고리로 벗어나지 않는다.",
  ].join("\n");
}
