import fs from "node:fs";

const lessonsPath = "data/fire_lessons.json";
const questionsPath = "data/fire_questions.json";
const lessons = JSON.parse(fs.readFileSync(lessonsPath, "utf8"));
const questions = JSON.parse(fs.readFileSync(questionsPath, "utf8"));

const topics = [
  ["DC_LAWS", "직류회로와 옴의 법칙", "전압·전류·저항의 관계와 직류회로 기본 계산", ["옴의 법칙", "저항", "전압", "전류"]],
  ["KIRCHHOFF", "키르히호프 법칙", "회로망의 전류법칙과 전압법칙", ["키르히호프", "회로망"]],
  ["SERIES_PARALLEL", "직렬·병렬회로", "합성저항과 분압·분류 관계", ["직렬", "병렬", "합성저항", "분압", "분류"]],
  ["DC_POWER", "직류 전력과 전력량", "직류 부하의 전력과 전력량 계산", ["전력", "전력량", "P=VI", "kWh"]],
  ["AC_WAVE", "교류 파형과 기본량", "정현파·주파수·주기·실효값", ["교류", "정현파", "주파수", "실효값"]],
  ["PHASOR", "위상과 페이저", "교류의 위상차와 페이저 표현", ["위상", "페이저", "위상차"]],
  ["RLC", "R·L·C 교류회로", "저항·코일·콘덴서의 교류 특성", ["RLC", "리액턴스", "인덕턴스", "정전용량"]],
  ["RESONANCE", "공진회로", "직렬·병렬 공진과 공진 주파수", ["공진", "공진주파수"]],
  ["AC_POWER", "교류전력과 역률", "유효·무효·피상전력과 역률", ["역률", "유효전력", "무효전력", "피상전력"]],
  ["THREE_PHASE", "삼상회로와 결선", "Y결선·Δ결선의 전압과 전류 관계", ["3상", "삼상", "Y결선", "델타", "Δ결선"]],
  ["MATERIALS", "도체·절연체·반도체", "전기재료의 특성과 온도계수", ["도체", "절연체", "반도체", "도전율"]],
  ["MEASUREMENT", "전기 계측", "전류계·전압계·전력계의 접속과 측정", ["전류계", "전압계", "전력계", "측정"]],
  ["MAGNETIC", "자기회로와 자성체", "자속·자속밀도·투자율·자기저항", ["자속", "자속밀도", "투자율", "자기회로"]],
  ["INDUCTION", "전자유도와 인덕턴스", "패러데이·렌츠 법칙과 유도기전력", ["전자유도", "유도기전력", "패러데이", "렌츠"]],
  ["TRANSFORMER", "변압기", "변압비·권수비·변압기 특성", ["변압기", "변압비", "권수비"]],
  ["MACHINE", "전기기기", "발전기·전동기·동기기의 기본 원리", ["전동기", "발전기", "동기기"]],
  ["SEMICONDUCTOR", "반도체 소자와 정류", "다이오드·트랜지스터·정류회로", ["다이오드", "트랜지스터", "정류", "사이리스터"]],
  ["LOGIC", "논리회로와 불대수", "논리게이트·진리표·불대수", ["논리회로", "논리게이트", "불대수", "AND", "NAND"]],
  ["SEQUENCE", "시퀀스 제어", "릴레이·접점·자기유지·인터록", ["시퀀스", "릴레이", "접점", "자기유지", "인터록"]],
  ["CONTROL", "자동제어 기본", "제어량·목표값·외란과 제어방식", ["자동제어", "제어량", "외란", "서보"]],
  ["TRANSFER", "전달함수와 궤환", "블록선도·전달함수·피드백", ["전달함수", "블록선도", "피드백", "궤환"]],
  ["SENSOR_PROTECTION", "검출소자와 전기 보호", "센서·접지·차단기·보호장치", ["서미스터", "센서", "접지", "차단기", "보호장치"]]
];

const lawTopics = [
  ["GENERAL", "소방관계법 총칙·목적·용어", "소방관계법의 목적과 주요 용어", ["총칙", "목적", "용어"]],
  ["BASIC_AUTHORITY", "소방기본법의 권한과 명령", "소방기관의 권한과 현장 명령", ["소방본부장", "소방서장", "명령", "권한"]],
  ["FIRE_INVESTIGATION", "화재조사와 소방활동", "화재조사 및 소방활동의 법적 기준", ["화재조사", "소방활동", "조사"]],
  ["BUILDING_APPROVAL", "건축허가 동의", "건축허가 등의 소방 동의 절차", ["건축허가", "동의", "회신"]],
  ["SPECIAL_INSPECTION", "소방특별조사", "소방특별조사의 대상과 절차", ["소방특별조사", "조사대상", "통보"]],
  ["SAFETY_MANAGER", "소방안전관리자", "소방안전관리자 선임과 등급", ["소방안전관리자", "선임", "1급", "2급"]],
  ["SELF_INSPECTION", "자체점검과 점검기준", "작동점검·종합점검과 점검 절차", ["자체점검", "작동점검", "종합점검"]],
  ["TARGET_CLASS", "특정소방대상물 분류", "특정소방대상물과 특수장소의 분류", ["특정소방대상물", "특수장소", "대상물"]],
  ["FACILITY_CLASS", "소방시설 종류와 설치대상", "소화·경보·피난·소화활동설비의 분류", ["소화설비", "경보설비", "피난설비", "소화활동설비"]],
  ["CONSTRUCTION_BUSINESS", "소방시설공사업", "소방시설공사업 등록과 업무 범위", ["소방시설공사업", "공사업", "등록"]],
  ["MANAGEMENT_BUSINESS", "소방시설관리업", "소방시설관리업과 기술인력 기준", ["소방시설관리업", "관리업", "기술인력"]],
  ["HAZARD_CLASS", "위험물의 유별과 성질", "제1류부터 제6류까지 위험물 분류", ["위험물", "제1류", "제4류", "지정수량"]],
  ["HAZARD_LOCATION", "제조소·저장소·취급소", "위험물 제조소등의 종류와 용도", ["제조소", "저장소", "취급소", "주유취급소"]],
  ["HAZARD_TANK", "위험물 탱크·방유제·안전거리", "탱크시설의 구조와 주요 수치 기준", ["옥외탱크", "지하탱크", "방유제", "안전거리"]],
  ["HAZARD_SIGN", "위험물 표지와 게시기준", "위험물 시설의 표지·게시판 기준", ["위험물 표지", "게시판", "색상"]],
  ["HAZARD_INSPECTION", "위험물 정기점검과 자체소방대", "위험물시설의 점검과 관리 체계", ["정기점검", "자체소방대", "예방규정"]],
  ["ADMIN_PENALTY", "행정처분과 벌칙", "법규 위반에 따른 행정처분·벌칙", ["벌칙", "과태료", "행정처분"]],
  ["NUMERIC_DEADLINES", "법규 수치·기한·지정수량", "법정 수치와 기한을 종합 정리", ["기한", "거리", "수치", "지정수량"]]
];

const facilityTopics = [
  ["DETECTION_SYSTEM", "자동화재탐지설비 전체 구성", "감지기·수신기·중계기·회로의 전체 구조", ["자동화재탐지설비", "감지기", "수신기", "회로"]],
  ["DETECTOR_COMMON", "감지기의 공통 원리", "감지기의 작동 원리와 설치 기준", ["감지기", "작동", "설치"]],
  ["HEAT_DETECTOR", "열감지기", "정온식·차동식·보상식 열감지기", ["정온식", "차동식", "보상식", "열감지기"]],
  ["SMOKE_DETECTOR", "연기감지기", "이온화식·광전식 연기감지기", ["연기감지기", "이온화식", "광전식", "분리형"]],
  ["FLAME_DETECTOR", "불꽃·특수감지기", "불꽃감지기와 특수 검출소자", ["불꽃감지기", "적외선", "자외선", "초전"]],
  ["RECEIVER", "수신기", "수신기의 기능·형식·설치 기준", ["수신기", "수신", "표시"]],
  ["REPEATER_MANUAL", "중계기·발신기·지구경종", "중계·발신·경종 장치의 기능과 연결", ["중계기", "발신기", "지구경종"]],
  ["ZONE_CIRCUIT", "경계구역과 회로", "경계구역·배선·도통시험", ["경계구역", "도통시험", "배선"]],
  ["EMERGENCY_ALARM", "비상경보설비", "비상벨·자동식 사이렌 등 경보설비", ["비상경보", "비상벨", "사이렌"]],
  ["BROADCAST", "비상방송설비", "확성기·음향장치·방송 배선", ["비상방송", "확성기", "음향장치"]],
  ["AUTO_REPORT", "자동화재속보설비", "화재신호의 자동 통보와 속보기", ["자동화재속보", "속보기", "자동통보"]],
  ["LEAK_ALARM", "누전경보기", "누설전류 검출과 누전경보 기준", ["누전경보기", "누설전류", "감도"]],
  ["WIRELESS_COMM", "무선통신보조설비", "증폭기·무선통신보조설비·비상전원", ["무선통신보조설비", "증폭기", "통신"]],
  ["GUIDANCE_LIGHT", "유도등", "피난구·통로·객석유도등의 종류와 설치", ["유도등", "피난구유도등", "통로유도등"]],
  ["EMERGENCY_LIGHT", "비상조명등", "비상조명등의 작동과 설치 기준", ["비상조명등", "작동시간", "조도"]],
  ["EMERGENCY_OUTLET", "비상콘센트설비", "비상콘센트의 전원·회로·설치 기준", ["비상콘센트", "전용회로", "보호함"]],
  ["EMERGENCY_POWER", "비상전원·축전지·자가발전", "소방설비용 비상전원의 종류와 용량", ["비상전원", "축전지", "자가발전", "예비전원"]],
  ["SMOKE_CONTROL", "제연설비의 전기 제어", "제연설비의 제어·전원·연동", ["제연설비", "제연", "연기", "비상전원"]],
  ["SUPPRESSION_INTERLOCK", "소화설비 전기연동·펌프 기동", "소화설비의 기동신호와 전기연동", ["옥내소화전", "프리액션", "솔레노이드", "펌프"]],
  ["WIRING_VOLTAGE", "배선·전압강하·접지·전기 기준", "소방시설 배선과 전기적 안전 기준", ["전압강하", "접지", "배선", "전원"]]
];

function makeLesson([code, title, summary, keywords], index) {
  const id = `ELECTRIC_${code}_001`;
  const text = (q) => [q.question, q.explanation, ...(q.choices || []).map((c) => c.text)].join(" ");
  const relatedQuestionIds = questions
    .filter((q) => q.subjectId === "electric_circuit" && keywords.some((word) => text(q).includes(word)))
    .map((q) => q.id)
    .slice(0, 120);
  return {
    id, subjectId: "electric_circuit", chapterId: "소방전기회로", title,
    level: index < 10 ? "beginner" : "intermediate", summary,
    conceptCards: [
      { id: `CARD-${id}-CORE`, title: `${title} 핵심`, body: `${summary}를 기출문제와 연결해 학습한다.`, keywords },
      { id: `CARD-${id}-POINT`, title: "시험 포인트", body: `${keywords.slice(0, 4).join("·")}의 관계와 단위를 구분한다.`, keywords }
    ],
    memorizationItems: [
      { id: `MEM-${id}-1`, type: "short-answer", prompt: `${title}의 핵심 개념을 단답식으로 쓰시오.`, answer: title, acceptableAnswers: [title], hint: summary, answerLabel: "핵심 개념" },
      { id: `MEM-${id}-2`, type: "short-answer", prompt: `${title}에서 기억해야 할 핵심 항목을 쓰시오.`, answer: keywords.slice(0, 3).join(", "), acceptableAnswers: [keywords.slice(0, 3).join(", ")], hint: summary, answerLabel: "핵심 항목" }
    ],
    relatedQuestionIds,
    verification: { required: ["TRANSFORMER", "AC_POWER", "THREE_PHASE", "DC_POWER", "RLC", "RESONANCE"].includes(code), status: "needs_review" }
  };
}

function makeLawLesson([code, title, summary, keywords], index) {
  const id = `LAW_${code}_001`;
  const text = (q) => [q.question, q.explanation, ...(q.choices || []).map((c) => c.text)].join(" ");
  const relatedQuestionIds = questions
    .filter((q) => q.subjectId === "fire_law" && keywords.some((word) => text(q).includes(word)))
    .map((q) => q.id)
    .slice(0, 120);
  return {
    id, subjectId: "fire_law", chapterId: "소방관계법규", title,
    level: index < 8 ? "beginner" : "intermediate", summary,
    conceptCards: [
      { id: `CARD-${id}-CORE`, title: `${title} 핵심`, body: `${summary}를 관련 기출문제와 함께 학습한다.`, keywords },
      { id: `CARD-${id}-POINT`, title: "시험 포인트", body: `${keywords.slice(0, 4).join("·")}의 주체·대상·기준을 구분한다.`, keywords }
    ],
    memorizationItems: [
      { id: `MEM-${id}-1`, type: "short-answer", prompt: `${title}의 핵심 개념을 단답식으로 쓰시오.`, answer: title, acceptableAnswers: [title], hint: summary, answerLabel: "핵심 개념" },
      { id: `MEM-${id}-2`, type: "short-answer", prompt: `${title}의 핵심 항목을 쓰시오.`, answer: keywords.slice(0, 3).join(", "), acceptableAnswers: [keywords.slice(0, 3).join(", ")], hint: summary, answerLabel: "핵심 항목" }
    ],
    relatedQuestionIds,
    verification: { required: true, status: "needs_review" }
  };
}

function makeFacilityLesson([code, title, summary, keywords], index) {
  const id = `FACILITY_${code}_001`;
  const text = (q) => [q.question, q.explanation, ...(q.choices || []).map((c) => c.text)].join(" ");
  const relatedQuestionIds = questions
    .filter((q) => q.subjectId === "fire_facility_electric" && keywords.some((word) => text(q).includes(word)))
    .map((q) => q.id)
    .slice(0, 120);
  return {
    id, subjectId: "fire_facility_electric", chapterId: "소방전기시설의 구조 및 원리", title,
    level: index < 10 ? "beginner" : "intermediate", summary,
    conceptCards: [
      { id: `CARD-${id}-CORE`, title: `${title} 핵심`, body: `${summary}를 시설의 구성과 작동 흐름으로 학습한다.`, keywords },
      { id: `CARD-${id}-POINT`, title: "시험 포인트", body: `${keywords.slice(0, 4).join("·")}의 기능·설치·기준을 구분한다.`, keywords }
    ],
    memorizationItems: [
      { id: `MEM-${id}-1`, type: "short-answer", prompt: `${title}의 핵심 개념을 단답식으로 쓰시오.`, answer: title, acceptableAnswers: [title], hint: summary, answerLabel: "핵심 개념" },
      { id: `MEM-${id}-2`, type: "short-answer", prompt: `${title}의 핵심 구성 또는 기준을 쓰시오.`, answer: keywords.slice(0, 3).join(", "), acceptableAnswers: [keywords.slice(0, 3).join(", ")], hint: summary, answerLabel: "핵심 항목" }
    ],
    relatedQuestionIds,
    verification: { required: true, status: "needs_review" }
  };
}

const theory = lessons
  .filter((lesson) => lesson.subjectId === "fire_theory")
  .slice(0, 22)
  .map((lesson) => ({ ...lesson, memorizationItems: (lesson.memorizationItems || []).slice(0, 2) }));
const electric = topics.map(makeLesson);
const law = lawTopics.map(makeLawLesson);
const facility = facilityTopics.map(makeFacilityLesson);
const allLessons = [...theory, ...electric, ...law, ...facility].map((lesson) => {
  const items = [...(lesson.memorizationItems || [])];
  if (items.length < 3) {
    const keywords = lesson.conceptCards?.[1]?.keywords || lesson.conceptCards?.[0]?.keywords || [];
    items.push({
      id: `MEM-${lesson.id}-3`,
      type: "short-answer",
      prompt: `${lesson.title}에서 시험에 자주 나오는 핵심 기준을 쓰시오.`,
      answer: keywords.slice(0, 3).join(", ") || lesson.title,
      acceptableAnswers: [keywords.slice(0, 3).join(", ") || lesson.title],
      hint: lesson.summary,
      answerLabel: "시험 핵심 기준"
    });
  }
  return { ...lesson, memorizationItems: items.slice(0, 3) };
});
fs.writeFileSync(lessonsPath, `${JSON.stringify(allLessons, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ total: allLessons.length, fire_theory: theory.length, electric_circuit: electric.length, fire_law: law.length, fire_facility_electric: facility.length, memorizationItemsPerLesson: [...new Set(allLessons.map((x) => x.memorizationItems.length))], zeroQuestionLessons: allLessons.filter((x) => !x.relatedQuestionIds.length).map((x) => x.id) }, null, 2));
