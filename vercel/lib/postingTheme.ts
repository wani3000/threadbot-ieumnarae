import { getEnv } from "@/lib/env";

export type PostingTheme = {
  order: number;
  category: string;
  guidance: string;
  example: string;
  fullExample: string;
};

const THEMES: PostingTheme[] = [
  {
    order: 1,
    category: "면접 예상질문 관련",
    guidance: "면접 예상질문과 답변 방향을 짝으로 제시하고, 체력관리/스트레스관리/이미지메이킹 같은 실전 항목을 담는다.",
    example: "체력·스트레스·이미지메이킹 질문 대비 포인트를 제시한다.",
    fullExample: `📝 승무원 면접 질문 20개 & 답변 샘플[2-2]
11. 체력 관리
Q. 장거리 비행 체력은 어떻게 관리하나요?
A.
"규칙적인 운동과 식습관, 짧은 시간이라도 수면 루틴을 지키며 체력을 유지해왔습니다."
12. 스트레스 관리
Q. 스트레스는 어떻게 풀나요?
A.
"걷기와 글쓰기를 통해 마음을 정리합니다. 스스로를 다스리는 습관이 비행에서도 침착함으로 이어진다고 생각합니다."
13. 이미지 메이킹
Q. 승무원의 외적 이미지에 대해 어떻게 생각하나요?
A.
"단정하고 안정감을 주는 외모는 승객에게 신뢰를 줍니다. 하지만 진짜 이미지는 태도와 서비스에서 나온다고 생각합니다."`,
  },
  {
    order: 2,
    category: "대한항공 지원 비전공자 조언",
    guidance: "비전공자 시선에서 서비스 태도, 직무 적합성, 솔직한 학습 태도를 강조한다.",
    example: "전공보다 승무원다운 태도와 서비스 관점이 핵심이라는 메시지.",
    fullExample: `비전공자 분들이 특히 점검해보면 좋을 부분은
- 나의 스펙을 앞세우기보다, 승무직에 어울리는 태도로 풀어내고 있는지
- 역량을 강조하려다 서비스 직무와 동떨어진 표현을 쓰고 있지는 않은지
- '나 잘났다'가 아니라 '서비스 중심'으로 이야기를 전개하고 있는지
비전공자의 강점은 전문 항공 지식이 아니라 서비스 직무에 대한 이해와 태도에 있다고 생각합니다.
항공과 전공자는 관련 지식을 질문받을 가능성이 조금 더 있을 수 있지만 비전공자는 모르는 부분이 있다면 솔직하게 말씀드리고 입사 후 배우겠다는 태도를 보여주는 것도 하나의 방법이거든요:)!
결국 중요한 건 전공 여부가 아니라 승무원답게 사고하고, 승무원답게 행동하는 사람인지입니다.
면접 연습은 일상에서부터 그 태도로 사시는 게 가장 낫습니다!`,
  },
  {
    order: 3,
    category: "승무원 준비 꿀팁",
    guidance: "실행 가능한 준비 루틴 중심으로 작성하고 체력, 질문 의도 파악, 기본 습관을 포함한다.",
    example: "지금 시기에 집중할 준비 항목을 우선순위로 제시한다.",
    fullExample: `[2026 승준, 이렇게 하세요 (1편)]
1️⃣ 2026 대규모 채용이 예상됩니다. 이런 시기에 승준을 하는 건 입니다.
100명 중 99등 해도 합격할 수 있기 때문이에요. 채용이 얼어붙었을 때에는 100명 중에 30등해도 합격이 어려웠던 때가 있었죠.
2️⃣ 그래서! 올해 사력을 다하셔야 합니다. 제가 만약 지금 시기에 승준생이라면 이 "네 가지"에 집중할 것 같아요.
3️⃣ 첫 번째는 "체력"입니다.
4️⃣ 이런 예상질문 준비한 적 있으시죠?
"어떻게 스트레스를 해소하는지", "힘들 때 어떻게 버티는지", "승무원 일이 어떤 일인지 말해봐라"
5️⃣ 모두 <우리 회사 스케쥴 힘들텐데 너 잘 버틸 수 있어?>라는 의도입니다. 실제로 자체 체력 테스트를 진행하는 회사가 늘고있습니다. 특히나 LCC의 경우 승무원 피로도가 높은 편이기 때문에 더더욱 그렇습니다.`,
  },
  {
    order: 4,
    category: "면접 관련",
    guidance: "면접관이 보는 포인트와 입실 태도, 시선, 긴장 관리 등 현장성 있는 팁을 담는다.",
    example: "표정 관리, 시선 처리, 모르는 질문 대응법 중심.",
    fullExample: `1. [면접 시리즈]
제목:
✈️ 대한항공 면접관은 이걸 본다. (13년 차 전직 승무원의 진짜 팁)
본문:
"승무원 면접에서 제일 중요한 건 외모일까요?
아니요. 이미지 관리와 상황 대처력입니다.
제가 면접관 앞에서 합격했던 이유는, 완벽한 영어 발음이 아니라
'긴장한 티를 최소화한 표정 관리'와 '시선을 놓치지 않는 태도'였어요.
📌 3초 법칙: 입실 후 3초 동안 면접관을 바라보며 부드럽게 미소 짓기.
📌 질문 끝, 답변 시작 전 1초: 호흡을 가다듬고 'Thank you'로 연결.
📌 모르는 질문: 돌려 말하기보다 '정직한 태도 + 긍정적 마무리'
승무원은 답을 아는 사람보다, 어떤 상황에서도 웃으며 해결하는 사람을 뽑습니다."`,
  },
  {
    order: 5,
    category: "전직 승무원이 본 객실승무원 필요 역량",
    guidance: "팀워크, 글로벌 역량, 사회성, 침착함 등 핵심 역량을 실무 맥락으로 설명한다.",
    example: "기내 팀워크와 침착한 상황대처의 중요성.",
    fullExample: `▪️팀워크
- 기내에서 하는 일은 대부분 팀워크야. 나 혼자했더라도 꼭 다른 승무원들에게 공유해야하지.
'내가 맡은 구역 기내식 다 드렸으니 난 이제 쉬어야지'
이런 생각은 안 되겠지? 내 할일이 끝나면 다른 승무원들도 도와야하는게 우리의 임무야!
▪️글로벌 역량
- 대략 세어보니 나도 매달 전세계인 3,000명을 만나고 있더라고. 기내에 탑승하는 손님의 국적과 문화는 다양해. 외국어 능력도 갖춰야하겠지만, 다양한 나라의 문화적 특성을 존중하는 모습도 필요해.
(ex. 종교적 이유로 돼지고기나 소고기를 안 드시는 손님)
▪️사회성
- 처음 보는 승객, 나이 차이 많이 나는 선후배를 만나도 마치 어제도 만난 것처럼 방긋방긋 웃고 친절하게 대해야해.
▪️침착함
- 기내 응급 상황, 비상 상황 시 승무원이 당황해하면손님들은 그 승무원을 신뢰할 수 있을까? 어떤 상황이든 침착하게 대안을 생각하고 상황을 리드할줄 알아야해.`,
  },
  {
    order: 6,
    category: "영상면접 꿀팁",
    guidance: "영상 프레임, 카메라 비율, 화면 인상, 헤어와 의상 균형처럼 영상면접 특화 포인트를 담는다.",
    example: "영상 프레임 안에서 균형감 있게 보이도록 조정하는 팁.",
    fullExample: `[승준생들, 영상면접 "비율" 신경써야 합격해요]
영상면접 합격/불합격 때 실제 캡쳐본 들고왔어 🤭
합격하려면 첫눈에 딱 봤을 때 "균형잡힌 비율이다"라는 느낌을 줘야 해,
그러려면..
1️⃣승무원 합격하는 비율의 비밀?
: 얼굴 상:중:하가 1:1:1이다.. 등의 연예인 얼굴 분석 영상이 있지만
우리 연예인 준비생 아니고 승준생이잖아?
완벽한 비율이 될 필요도 없고 ❌
보기에 모난 부분 없이 눈이 편안한 비율을 만들어주면 돼 ⭕️
2️⃣ 캠에 나오는 본인 얼굴의 장단점을 정확히 파악한다
: 미감 좋은 친구들에게 팩트로 말해달라고 부탁하기.
3️⃣ 장점은 부각시키고 단점은 완화한다
: ex) 얼굴이 길어보일 땐? 헤어 볼륨 / 의상 활용하기.
ex) 이목구비에 직선이 많은 편이라면? 머리와 의상에 곡선을 넣어 부드럽게 표현해주기
>> 균형잡힌 비율 완성 ✨`,
  },
  {
    order: 7,
    category: "대면 면접 관련",
    guidance: "대면 면접에서는 답변을 장면처럼 말하는 법, 현장감, 입실 분위기, 전달력을 강조한다.",
    example: "답변은 문장 나열보다 장면 설명 중심으로 쓴다.",
    fullExample: `대면 면접 준비해야지 🙆🏻‍♀️
답변 구성 꿀팁 가보자~!
1. 답변은 문장이 아니라 ’장면‘으로 쓴다
스터디 하다 보면 유독 답변이
쏙쏙 잘 들리는 친구들 있지?
상황만 줄줄 읊는게 아니라
마치 듣는 사람도 그 공간에
같이 있었던 기분이 들도록
썰 풀듯이 말하는게 바로 그 비결이야
<예시>
‘위기 상황이 발생했을 때 침착하게 주변을 살피며 필요한 조치를 신속하게 취했습니다. 도움 요청과 상황 판단을 빠르게 수행했습니다.’
‘수업을 듣던 중 옆자리 동료가 쓰러지는 상황이
있었습니다. 즉시 친구의 상태를 살피며 주변에 큰 소리로 도움을 요청했고, 의료장비가 필요하다는 생각이 들어 함께 부탁했습니다.‘
두 답변의 차이가 좀 보일까?
곧 인스타그램에 영상도 올리니까
예시를 한번 찬찬히 들어보고 비교해 봐
그 포인트를 알면 나도 흡입력 있는
답변 말할 수 있다💪🏻`,
  },
];

const THEME_KEYWORDS: string[][] = [
  ["예상질문", "질문", "답변", "체력", "스트레스", "이미지"],
  ["비전공", "전공", "서비스", "태도", "대한항공", "직무"],
  ["꿀팁", "루틴", "준비", "체력", "질문의도", "습관"],
  ["면접관", "표정", "시선", "긴장", "질문", "대응"],
  ["팀워크", "글로벌", "사회성", "침착", "역량", "기내"],
  ["영상면접", "비율", "캠", "카메라", "프레임", "화면"],
  ["대면 면접", "장면", "입실", "현장", "전달", "답변"],
];

const DEFAULT_ROTATION_START_DATE = "2026-03-09";

function parseKstDate(dateKst: string): Date {
  return new Date(`${dateKst}T12:00:00+09:00`);
}

function isWeekendDate(dateKst: string): boolean {
  const weekday = parseKstDate(dateKst).getUTCDay();
  return weekday === 0 || weekday === 6;
}

function addDate(dateKst: string, days: number): string {
  const date = parseKstDate(dateKst);
  date.setUTCDate(date.getUTCDate() + days);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function businessDayDistance(startDateKst: string, targetDateKst: string): number {
  if (startDateKst === targetDateKst) return 0;
  let cursor = startDateKst;
  let distance = 0;
  const direction = parseKstDate(targetDateKst).getTime() >= parseKstDate(startDateKst).getTime() ? 1 : -1;

  while (cursor !== targetDateKst) {
    cursor = addDate(cursor, direction);
    if (isWeekendDate(cursor)) continue;
    distance += direction;
  }

  return distance;
}

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

export function getPostingThemeRotationStartDate(): string {
  return getEnv("POSTING_THEME_ROTATION_START_DATE", DEFAULT_ROTATION_START_DATE);
}

export function getPostingTheme(dateKst: string): PostingTheme {
  if (isWeekendDate(dateKst)) {
    throw new Error(`Weekend dates are not valid posting dates: ${dateKst}`);
  }
  const index = mod(businessDayDistance(getPostingThemeRotationStartDate(), dateKst), THEMES.length);
  return THEMES[index];
}

export function isPostMatchingPostingTheme(dateKst: string, post: string): boolean {
  const theme = getPostingTheme(dateKst);
  const keywords = THEME_KEYWORDS[theme.order - 1] || [];
  const text = post.toLowerCase();
  return keywords.some((k) => text.includes(k.toLowerCase()));
}

export function getPostingThemeTable(): Array<{ order: number; category: string; example: string; fullExample: string }> {
  return THEMES.map((theme) => ({
    order: theme.order,
    category: theme.category,
    example: theme.example,
    fullExample: theme.fullExample,
  }));
}

export function getPostingThemePrompt(dateKst: string): string {
  const theme = getPostingTheme(dateKst);
  return [
    `평일 게시 주제 순환 규칙: 이번 게시 차례는 ${theme.order}번 주제인 "${theme.category}"이다.`,
    `작성 가이드: ${theme.guidance}`,
    `예시 톤 참고: ${theme.example}`,
    "다른 주제로 벗어나지 않는다.",
  ].join("\n");
}
