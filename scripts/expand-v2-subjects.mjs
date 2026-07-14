import path from "node:path";
import {
  learningDir,
  loadContentFiles,
  readJson,
  sortByLearningOrder,
  unique,
  writeJson
} from "./data-pipeline-utils.mjs";

const REVIEW_CYCLE = ["D+1", "D+3", "D+7"];
const SCHEMA_VERSION = "2.0-compatible-v1";

const contentDefinitions = [
  makeContent("06_contents_electric_basic.json", 27, "EC_BASIC_DC_LAW_001", "소방전기회로", "전기 기초", "직류 회로 기본 법칙", "기초 전압·전류·저항 관계를 정리한다.", "옴의 법칙, 분압·분류, 합성저항, 전력 계산은 직류 회로의 기본 축이다.", "전압, 전류, 저항이 어떻게 서로 바뀌는지부터 잡아야 계산형 문제가 풀린다.", "V=IR, 직류는 합성저항과 전력 계산이 핵심", "단위 변환과 전력량 계산을 함께 묶어 출제하는 경우가 많다.", "공식만 외우고 직렬·병렬 조건을 놓치면 오답으로 이어진다.", "직류 회로 문제는 옴의 법칙과 전력 계산을 정확히 적용하는 것이 핵심이다.", ["저항", "전류", "전압", "옴의 법칙", "합성저항", "단자전압", "전력량", "kWh"], "high"),
  makeContent("06_contents_electric_basic.json", 28, "EC_BASIC_NETWORK_001", "소방전기회로", "전기 기초", "회로 해석 정리", "회로망 해석 법칙과 정리를 구분한다.", "키르히호프 법칙, 중첩의 원리, 등가회로 정리는 복잡한 회로를 계산 가능한 형태로 바꾸는 기준이다.", "복잡한 회로는 한 번에 풀지 않고 법칙에 따라 나누어 보는 것이 핵심이다.", "키르히호프 + 중첩 + 등가회로 = 회로 해석 기본", "회로도와 식을 연결하는 문제에서 회로망 정리가 자주 등장한다.", "회로 모양만 보고 공식을 바로 적용하면 조건을 틀리기 쉽다.", "회로 해석 문제는 법칙과 정리를 상황에 맞게 선택하는 것이 중요하다.", ["키르히호프", "중첩", "테브난", "노튼", "회로망", "브리지"], "medium"),
  makeContent("06_contents_electric_basic.json", 29, "EC_BASIC_CAPACITOR_001", "소방전기회로", "전기 기초", "정전용량과 콘덴서", "정전용량과 유전체 특성을 구분한다.", "콘덴서는 전하를 저장하며 정전용량, 전위차, 유전체 특성으로 성능이 결정된다.", "축전기는 전기를 잠깐 담아 두는 장치로 이해하면 접근이 쉽다.", "콘덴서 = 전하 저장 + 정전용량", "유전체와 정전용량 변화를 연결하는 문제를 조심해야 한다.", "전하량과 전압 관계를 혼동하면 계산이 틀어진다.", "콘덴서 문제는 정전용량과 전하 저장 개념을 정확히 잡는 것이 우선이다.", ["콘덴서", "정전용량", "유전체", "축전기", "전기용량"], "medium"),
  makeContent("06_contents_electric_basic.json", 30, "EC_BASIC_MAGNETIC_001", "소방전기회로", "전기 기초", "자기회로와 자성체", "자기회로의 기본량과 자성체 성질을 구분한다.", "자속, 자속밀도, 투자율, 자기저항은 자기회로를 해석하는 핵심 물리량이다.", "전기회로의 전압·전류처럼 자기회로도 자속과 자기저항으로 읽는다.", "자기회로 = 자속 + 투자율 + 자기저항", "자기량의 단위와 정의를 묻는 문제는 짧게 나와도 실수가 많다.", "자속과 자계, 자속밀도를 같은 개념처럼 보면 틀린다.", "자기회로 문제는 자속과 자성체 특성의 관계를 분리해 이해해야 한다.", ["자속", "자장", "자속밀도", "투자율", "자기회로", "자기저항", "자성체"], "medium"),
  makeContent("06_contents_electric_basic.json", 31, "EC_BASIC_INDUCTION_001", "소방전기회로", "전기 기초", "전자유도와 인덕턴스", "유도기전력과 인덕턴스 관계를 정리한다.", "전자유도는 자속 변화가 기전력을 만든다는 개념이고, 인덕턴스는 그 변화에 대한 회로의 응답 특성이다.", "코일에 흐르는 전류나 자속이 바뀌면 전압이 생긴다는 흐름으로 이해하면 된다.", "전자유도 = 자속 변화, 인덕턴스 = 유도 저항 성격", "패러데이 법칙과 렌츠 법칙을 함께 묻는 문제가 반복된다.", "코일 문제를 단순 저항처럼 보면 교류와 유도 계산이 무너진다.", "전자유도 문제는 자속 변화와 전류 변화율을 함께 보는 것이 핵심이다.", ["유도기전력", "전자유도", "인덕턴스", "코일", "패러데이", "렌츠", "상호유도"], "high"),
  makeContent("06_contents_electric_basic.json", 32, "EC_BASIC_AC_001", "소방전기회로", "교류 회로", "교류 파형과 임피던스", "교류 파형의 기본량과 임피던스를 정리한다.", "정현파, 주파수, 위상, 실효값, 리액턴스, 임피던스는 교류회로의 기본 언어다.", "교류는 숫자 하나보다 파형과 위상차까지 같이 봐야 한다.", "교류 핵심 = 파형 + 실효값 + 임피던스", "정현파 식과 위상차를 결합한 문제가 자주 나온다.", "실효값과 최대값을 바꿔 대입하는 실수가 많다.", "교류 회로 문제는 파형의 기본량과 임피던스 해석이 함께 필요하다.", ["정현파", "교류회로", "주파수", "위상", "실효값", "리액턴스", "임피던스", "사인파"], "high"),
  makeContent("06_contents_electric_basic.json", 33, "EC_BASIC_POWER_FACTOR_001", "소방전기회로", "교류 회로", "전력과 역률", "유효전력, 무효전력, 역률 관계를 설명한다.", "교류 전력은 유효전력, 무효전력, 피상전력으로 나뉘며 역률은 그 관계를 해석하는 핵심 값이다.", "같은 전류라도 실제 일한 정도를 보는 것이 역률이다.", "P-Q-S와 역률은 세트로 암기", "전력계 지시값과 무효전력을 함께 계산하는 유형이 많다.", "피상전력과 유효전력을 같은 값처럼 다루면 틀린다.", "역률 문제는 전력 삼각형과 계산식을 함께 기억해야 풀린다.", ["역률", "유효전력", "무효전력", "피상전력", "전력계", "Var"], "high"),
  makeContent("06_contents_electric_basic.json", 34, "EC_BASIC_THREE_PHASE_001", "소방전기회로", "교류 회로", "삼상 회로와 결선", "Y결선과 Δ결선의 전압·전류 관계를 구분한다.", "삼상 회로는 결선 방식에 따라 선전압, 상전압, 선전류, 상전류 관계가 달라진다.", "Y와 Δ를 바꾸면 전압과 전류 기준이 같이 바뀐다는 점을 기억해야 한다.", "삼상 핵심 = 결선별 전압·전류 관계", "결선 변경 시 배수 관계를 묻는 문제가 반복 출제된다.", "선간전압과 상전압을 혼동하면 전체 계산이 틀어진다.", "삼상 회로 문제는 결선 형태를 먼저 판단한 뒤 식을 적용해야 한다.", ["3상", "삼상", "Y결선", "Δ결선", "델타결선", "성형결선", "선전류", "상전압"], "high"),
  makeContent("06_contents_electric_basic.json", 35, "EC_BASIC_MATERIAL_MEASURE_001", "소방전기회로", "전기 기초", "도체 재료와 계측", "도체·반도체·계기 연결 원리를 정리한다.", "재료의 도전 특성과 계기의 접속 방식은 회로 측정의 정확도를 좌우한다.", "무엇이 전기를 잘 통하는지, 계기를 어디에 붙여야 하는지를 같이 묻는 과목이다.", "도체 성질 + 계기 접속 = 측정 기본", "전류계 병렬, 전압계 직렬 같은 반대 개념 함정에 주의해야 한다.", "재료 성질 문제와 계기 문제를 따로 보면 전체 흐름을 놓친다.", "계측 문제는 재료 특성과 계기 연결 원리를 함께 이해해야 안정적으로 맞힌다.", ["절연체", "도체", "도전율", "반도체", "전류계", "전압계", "계기", "온도계수", "과전류차단기", "KEC"], "medium"),

  makeContent("07_contents_electric_control.json", 36, "EC_CTRL_SEMICON_001", "소방전기회로", "전자 회로", "반도체 소자와 정류", "다이오드·트랜지스터 기본 동작을 설명한다.", "반도체 소자는 정류, 증폭, 스위칭 기능으로 회로 동작을 만든다.", "전류를 한쪽으로만 흐르게 하거나 키우는 역할로 이해하면 접근이 쉽다.", "반도체 = 정류 + 증폭 + 스위칭", "정류회로 평균전압과 소자 특성을 함께 묻는 계산형이 많다.", "다이오드와 트랜지스터 역할을 섞어 기억하면 오답이 잦다.", "반도체 문제는 소자별 역할과 기본 식을 분리해서 기억해야 한다.", ["다이오드", "트랜지스터", "사이리스터", "정류", "증폭기", "반파", "전파"], "high"),
  makeContent("07_contents_electric_control.json", 37, "EC_CTRL_LOGIC_001", "소방전기회로", "전자 회로", "논리회로와 불대수", "논리게이트와 논리식을 해석한다.", "논리회로는 불대수와 진리표를 바탕으로 게이트 출력을 해석하는 분야다.", "입력이 들어왔을 때 0과 1이 어떻게 바뀌는지만 정확히 보면 된다.", "AND·OR·NOT부터 NAND/NOR까지 구조 이해", "회로도와 논리식을 서로 바꾸는 문제가 자주 나온다.", "게이트 이름만 외우고 출력 조건을 놓치면 틀린다.", "논리회로 문제는 진리표와 회로 형태를 함께 연결해야 풀린다.", ["논리회로", "논리식", "불대수", "게이트", "AND", "OR", "NOT", "NAND", "NOR", "XOR"], "high"),
  makeContent("07_contents_electric_control.json", 38, "EC_CTRL_SEQUENCE_001", "소방전기회로", "제어 회로", "시퀀스 회로 기본", "릴레이와 접점 중심의 시퀀스 회로를 해석한다.", "시퀀스 회로는 릴레이, 접점, 자기유지, 인터록을 이용해 동작 순서를 제어한다.", "전동기나 설비가 어떤 순서로 켜지고 꺼지는지 읽는 회로다.", "시퀀스 = 접점 상태 + 동작 순서", "자기유지와 인터록 회로를 도식으로 묻는 유형이 많다.", "접점의 a접점, b접점을 혼동하면 해석이 꼬인다.", "시퀀스 문제는 각 접점이 열린 상태인지 닫힌 상태인지부터 판단해야 한다.", ["시퀀스", "릴레이", "계전기", "접점", "자기유지", "인터록", "타이머"], "high"),
  makeContent("07_contents_electric_control.json", 39, "EC_CTRL_CONTROL_BASIC_001", "소방전기회로", "자동 제어", "자동제어의 기본 개념", "제어량과 제어방식의 기본 분류를 설명한다.", "자동제어는 목표값과 실제값의 차이를 줄이기 위해 제어량, 외란, 응답 특성을 다루는 체계다.", "무엇을 일정하게 유지하려는지와 무엇이 흔드는지를 구분하면 구조가 보인다.", "자동제어 = 목표값, 제어량, 외란", "서보제어와 프로세스제어를 구분하는 문제가 반복된다.", "제어 대상과 제어 방식을 섞어서 기억하면 분류 문제가 흔들린다.", "자동제어 기본은 제어 목적과 제어량의 성격을 먼저 구분하는 것이다.", ["제어량", "자동제어", "서보", "프로세스", "외란", "제어방식"], "medium"),
  makeContent("07_contents_electric_control.json", 40, "EC_CTRL_TRANSFER_001", "소방전기회로", "자동 제어", "전달함수와 궤환", "블록선도와 전달함수 계산 원리를 정리한다.", "전달함수는 입력과 출력의 관계를 나타내며, 부궤환·정궤환 구조에 따라 시스템 응답이 달라진다.", "블록선도는 복잡한 제어계를 식으로 바꿔 읽는 도구다.", "전달함수 = 블록선도 해석의 핵심", "부궤환 전달함수 문제는 거의 정형화된 형태로 반복 출제된다.", "전향경로와 궤환경로를 잘못 잡으면 전체 식이 바뀐다.", "전달함수 문제는 경로 이득과 궤환 방향을 먼저 확인해야 한다.", ["전달함수", "블록선도", "부궤환", "정궤환", "피드백", "루프 이득"], "high"),
  makeContent("07_contents_electric_control.json", 41, "EC_CTRL_SENSORS_001", "소방전기회로", "전자 회로", "검출소자와 센서", "검출소자의 특성과 용도를 구분한다.", "열전대, 서미스터, 광센서 같은 검출소자는 물리량을 전기신호로 바꾸는 핵심 장치다.", "무엇을 감지하는 소자인지부터 잡으면 문제 풀이가 쉬워진다.", "센서 = 물리량을 전기신호로 변환", "온도감지용 소자와 광학 검출소자를 비교하는 문제가 자주 나온다.", "센서 이름만 외우고 측정 대상 물리량을 놓치면 틀린다.", "검출소자 문제는 측정 대상과 동작 원리를 함께 기억해야 한다.", ["서미스터", "열전대", "센서", "검출부", "온도감지", "PZT", "초전"], "medium"),
  makeContent("07_contents_electric_control.json", 42, "EC_CTRL_PROTECTION_001", "소방전기회로", "제어 회로", "보호회로와 전기 규정", "보호장치와 전기설비 기준을 정리한다.", "과전류차단기, 접지, 전압 구분, 설비 기준은 현장 안전과 직접 연결되는 규정성 개념이다.", "회로를 작동시키는 것보다 안전하게 끊고 보호하는 기준이 중요하다.", "보호회로 = 차단 + 접지 + 기준 적용", "규정 숫자와 분류를 계산 문제처럼 묻는 경우가 많다.", "기능과 설치 기준을 분리하지 않으면 규정형 문제에서 흔들린다.", "보호회로 문제는 장치 역할과 기준 수치를 함께 기억해야 한다.", ["과전류차단기", "접지", "KEC", "전압의 구분", "보호장치"], "medium"),

  makeContent("08_contents_law.json", 43, "LAW_BASIC_FRAME_001", "소방관계법규", "총칙", "소방관계법의 목적과 체계", "법의 목적, 용어, 기본 구조를 설명한다.", "소방관계법규는 화재 예방, 경계, 진압, 조사와 국민의 생명·재산 보호를 목적으로 하는 법 체계다.", "각 법의 세부 조문보다 무엇을 보호하려는 법인지 먼저 알아야 한다.", "법규 기본 = 목적 + 용어 + 체계", "총칙 문제는 쉬워 보여도 정확한 문구 차이로 오답이 생긴다.", "비슷한 용어를 같은 뜻으로 보면 정의 문제가 틀린다.", "총칙은 전체 법규 문제를 해석하는 출발점이다.", ["목적", "총칙", "용어", "소방법의 목적"], "medium"),
  makeContent("08_contents_law.json", 44, "LAW_FIRE_COMMAND_001", "소방관계법규", "소방기본법", "화재대응 명령과 조사", "소방활동권한과 조사 범위를 정리한다.", "소방본부장과 소방서장의 명령, 소방활동구역, 화재조사 권한은 현장 대응의 법적 근거다.", "누가 무엇을 명령할 수 있는지를 묻는 법적 역할 문제다.", "권한 주체와 명령 대상 구분", "주체와 기한을 함께 섞어 출제하는 경우가 많다.", "권한과 임무를 바꿔 기억하면 선택지 함정에 걸린다.", "대응 법규는 권한 주체와 조치 내용을 정확히 짝지어야 한다.", ["소방본부장", "소방서장", "명령", "화재조사", "소방활동구역"], "medium"),
  makeContent("08_contents_law.json", 45, "LAW_BUILDING_APPROVAL_001", "소방관계법규", "화재예방법", "건축허가 동의와 조사", "건축허가 동의와 조사 절차를 구분한다.", "건축허가 등의 동의, 소방특별조사, 통보 기한은 예방 행정의 핵심 절차다.", "건물을 지을 때 소방서가 언제 어떻게 관여하는지 묻는 영역이다.", "동의 요청, 회신 기한, 조사 절차", "기한 숫자와 대상 건축물을 결합한 문제가 자주 나온다.", "동의와 승인, 통보를 같은 절차로 보면 틀린다.", "예방 행정 절차는 주체, 기한, 대상물을 같이 외워야 한다.", ["건축허가", "동의", "회신", "소방특별조사", "통보"], "high"),
  makeContent("08_contents_law.json", 46, "LAW_SAFETY_MANAGER_001", "소방관계법규", "안전관리", "소방안전관리자와 자체점검", "안전관리자 선임과 점검 체계를 정리한다.", "소방안전관리자 선임 대상, 등급, 자체점검은 소방대상물 유지관리의 기본이다.", "누가 관리 책임을 지고 어떤 점검을 해야 하는지를 묻는 파트다.", "안전관리 = 선임 + 점검 + 책임", "등급 기준과 점검 종류를 함께 섞는 문제가 많다.", "관리대상물 등급과 점검 항목을 따로 외우면 연결 문제가 틀린다.", "안전관리 파트는 대상물 규모와 관리 책임을 함께 봐야 한다.", ["소방안전관리자", "자체점검", "1급", "2급", "관리대상물"], "high"),
  makeContent("08_contents_law.json", 47, "LAW_FIRE_FACILITY_CLASS_001", "소방관계법규", "소방시설 기준", "소방시설의 종류와 설치대상", "소방시설 분류와 설치의무를 정리한다.", "소화설비, 경보설비, 피난설비, 소화활동설비, 소방용수시설은 설치 기준과 대상이 다르다.", "어떤 건물에 어떤 시설이 필요한지 구분하는 기본 분류다.", "시설 분류 + 대상물 적용", "특정소방대상물과 설비 종류를 짝짓는 문제가 많다.", "설비 이름만 알고 분류를 모르면 복합 선택지에서 흔들린다.", "시설 분류 문제는 설비군과 설치대상을 세트로 봐야 한다.", ["소화설비", "경보설비", "피난설비", "소화활동설비", "소방용수시설"], "high"),
  makeContent("08_contents_law.json", 48, "LAW_FIRE_BUSINESS_001", "소방관계법규", "소방산업", "공사업과 관리업 등록기준", "소방시설공사업과 관리업 기준을 구분한다.", "공사업, 관리업, 기술인력, 등록기준은 소방산업 관련 법규의 핵심 출제 축이다.", "업종마다 어떤 인력과 자격이 필요한지 보는 영역이다.", "공사업·관리업 = 등록기준 + 기술인력", "업종별 영업범위를 비교하는 문제가 자주 나온다.", "공사업과 관리업 요건을 섞어 외우면 오답이 많다.", "산업 관련 법규는 업종, 기준, 인력 요건을 나눠서 정리해야 한다.", ["공사업", "관리업", "등록기준", "기술인력", "영업범위"], "high"),
  makeContent("08_contents_law.json", 49, "LAW_HAZARD_CLASS_001", "소방관계법규", "위험물 분류", "위험물 유별과 성질", "위험물 유별과 성질을 정리한다.", "제1류부터 제6류까지의 성질, 예시 물질, 지정수량은 위험물 법규의 기본이다.", "위험물은 이름보다 어떤 성질을 가지는지가 더 중요하다.", "유별 = 성질 + 대표물질 + 지정수량", "제1류·제4류처럼 자주 출제되는 유별은 반복 암기가 필요하다.", "성질과 대표 물질을 바꿔 기억하면 분류 문제가 틀린다.", "위험물 유별 문제는 성질과 예시 물질을 연결해 기억해야 한다.", ["제1류", "제4류", "위험물", "산화성고체", "인화성액체", "지정수량"], "high"),
  makeContent("08_contents_law.json", 50, "LAW_HAZARD_LOCATION_001", "소방관계법규", "제조소등", "제조소·저장소·취급소 구분", "제조소등의 종류와 기준을 구분한다.", "제조소, 저장소, 취급소, 주유취급소, 판매취급소 등은 설치 기준과 용도가 다르다.", "어떤 장소에서 위험물을 어떻게 다루는지에 따라 법적 분류가 달라진다.", "제조소등 = 장소 종류 + 용도 기준", "주유취급소와 저장소 기준을 비교하는 문제가 많다.", "명칭이 비슷해도 설치 목적이 다르면 다른 답이 된다.", "제조소등 분류는 장소의 사용 목적과 구조 기준을 함께 봐야 한다.", ["제조소", "저장소", "취급소", "주유취급소", "판매취급소"], "high"),
  makeContent("08_contents_law.json", 51, "LAW_HAZARD_TANK_001", "소방관계법규", "제조소등", "탱크·방유제·안전거리", "탱크 저장 기준과 안전거리를 정리한다.", "옥외탱크, 지하탱크, 방유제, 매설 깊이, 안전거리는 위험물 저장시설 문제의 핵심 수치다.", "탱크는 구조보다 수치 기준을 정확히 기억해야 점수가 나온다.", "탱크 기준 = 깊이·높이·거리", "방유제 높이, 탱크 매설 깊이 같은 수치형 문제가 반복된다.", "숫자만 따로 외우면 어떤 시설 기준인지 섞이기 쉽다.", "탱크 기준은 시설 종류와 수치를 함께 묶어 기억해야 한다.", ["지하탱크", "옥외탱크", "방유제", "매설", "안전거리", "주유관"], "high"),
  makeContent("08_contents_law.json", 52, "LAW_HAZARD_SIGN_001", "소방관계법규", "위험물 표시", "위험물 표지와 게시기준", "표지의 색상과 게시 내용을 정리한다.", "위험물 시설의 표지, 게시판, 색상 구분은 법규형 암기 문제로 자주 나온다.", "현장에서 눈에 보이는 표시 기준을 묻는 파트다.", "표지 = 색상 + 문구 + 게시 위치", "색상과 문자 조합을 바꾸어 내는 함정이 많다.", "표지 기준은 외형이 비슷해 보여도 법정 조합을 정확히 기억해야 한다.", "표지 문제는 색상과 문구 조합을 세트로 외워야 한다.", ["표지", "게시판", "색상", "문자의 색"], "medium"),
  makeContent("08_contents_law.json", 53, "LAW_HAZARD_INSPECTION_001", "소방관계법규", "위험물 관리", "자체소방대와 정기점검", "위험물 시설의 점검·조직 기준을 정리한다.", "자체소방대, 예방규정, 정기점검 대상은 위험물안전관리법의 실무형 출제 포인트다.", "시설을 설치한 뒤 어떻게 관리하는지를 묻는 영역이다.", "위험물 관리 = 조직 + 점검 + 예방규정", "점검 대상과 제외 대상을 섞는 문제가 많다.", "관리 주체와 점검 대상을 분리해서 기억하지 않으면 틀린다.", "위험물 관리 파트는 설치 후 유지관리 체계를 이해하는 데 목적이 있다.", ["자체소방대", "정기점검", "예방규정", "위험물안전관리법"], "medium"),
  makeContent("08_contents_law.json", 54, "LAW_SPECIAL_TARGET_001", "소방관계법규", "대상물 분류", "특수장소와 특정소방대상물", "특수장소와 특정소방대상물 분류를 정리한다.", "위락시설, 공업지역, 아파트 등 대상물의 분류는 설치 기준과 안전관리 기준의 출발점이다.", "건물 종류를 어떻게 부르는지가 뒤의 모든 설치 기준을 바꾼다.", "대상물 분류가 기준 적용의 출발점", "특수장소 예시를 바꾸어 제시하는 문제가 자주 나온다.", "용도 분류를 정확히 못 잡으면 뒤의 기준도 같이 틀린다.", "대상물 분류는 설비 의무와 직접 연결되는 기본 전제다.", ["특수장소", "위락시설", "특정소방대상물", "아파트"], "medium"),

  makeContent("09_contents_facility_alarm.json", 55, "FAC_ALARM_SYSTEM_001", "소방전기시설의 구조 및 원리", "자동화재탐지설비", "자동화재탐지설비의 기본 구성", "자동화재탐지설비의 전체 구조를 설명한다.", "감지기, 수신기, 중계기, 회로, 경계구역은 자동화재탐지설비의 기본 뼈대다.", "어느 장치가 감지하고 어디서 표시하는지를 먼저 잡아야 세부 기준이 풀린다.", "감지기-회로-수신기 구조 이해", "배선과 경계구역 문제는 설비 전체 구조를 알아야 풀린다.", "구성품 이름만 외우고 역할을 모르면 회로 문제가 막힌다.", "자동화재탐지설비는 장치 역할과 배선 흐름을 함께 이해해야 한다.", ["자동화재탐지설비", "배선", "회로", "경계구역", "도통시험"], "high"),
  makeContent("09_contents_facility_alarm.json", 56, "FAC_ALARM_HEAT_001", "소방전기시설의 구조 및 원리", "감지기", "열감지기 종류와 원리", "정온식·차동식 등 열감지기를 구분한다.", "열감지기는 온도 상승 방식과 감열 구조에 따라 정온식, 차동식, 보상식, 분포형 등으로 나뉜다.", "어떻게 열을 느끼는지에 따라 감지기 종류가 갈린다.", "열감지기 = 작동 기준 + 검출 구조", "정온식과 차동식을 비교하는 문제가 반복된다.", "이름은 비슷하지만 작동 기준이 다르다는 점을 놓치면 틀린다.", "열감지기 문제는 작동 조건과 구조를 세트로 외워야 한다.", ["정온식", "차동식", "보상식", "열전대식", "분포형", "열반도체"], "high"),
  makeContent("09_contents_facility_alarm.json", 57, "FAC_ALARM_SMOKE_001", "소방전기시설의 구조 및 원리", "감지기", "연기감지기와 설치기준", "연기감지기 종류와 적용 기준을 설명한다.", "연기감지기는 이온화식, 광전식, 분리형 등으로 나뉘며 부착높이와 면적 기준이 중요하다.", "연기를 어떤 방식으로 보는지와 어디에 다는지가 같이 출제된다.", "연기감지기 = 검출방식 + 설치기준", "광전식과 이온화식 차이, 바닥면적 기준이 자주 나온다.", "감지 원리만 보고 설치 기준을 놓치면 점수를 잃는다.", "연기감지기 파트는 원리와 설치 수치를 동시에 기억해야 한다.", ["연기감지기", "이온화식", "광전식", "분리형", "감광", "부착높이"], "high"),
  makeContent("09_contents_facility_alarm.json", 58, "FAC_ALARM_FLAME_001", "소방전기시설의 구조 및 원리", "감지기", "불꽃·특수감지기", "불꽃감지기와 특수 감지방식을 정리한다.", "불꽃감지기, 적외선, 자외선, 초전소자 등은 특수 화재 징후를 빠르게 감지하기 위한 방식이다.", "열이나 연기 외에 빛과 복사를 보는 감지기라고 이해하면 된다.", "불꽃감지 = 광학·복사 검출", "적외선, 자외선, 초전재료 특성을 묻는 문제가 반복된다.", "열감지기와 불꽃감지기를 같은 축으로 보면 오답이 생긴다.", "특수감지기는 검출 대상 에너지와 소자 특성을 함께 봐야 한다.", ["불꽃감지기", "적외선", "자외선", "초전", "PZT"], "medium"),
  makeContent("09_contents_facility_alarm.json", 59, "FAC_ALARM_RECEIVER_001", "소방전기시설의 구조 및 원리", "수신기·회로", "수신기와 중계기", "수신기·중계기의 기능과 설치기준을 정리한다.", "수신기와 중계기는 화재신호를 수신·표시·전달하는 핵심 장치이며 설치 위치와 형식 기준이 중요하다.", "감지기가 본 신호를 어디서 받고 어떻게 넘기는지 보는 파트다.", "수신기 = 수신·표시, 중계기 = 전달·보조", "층수 조건에 따른 수신기 형식이나 설치 위치 문제가 많다.", "감지기 문제와 수신기 문제를 섞으면 설비 흐름이 꼬인다.", "수신기 파트는 장치 기능과 설치 위치를 같이 기억해야 한다.", ["수신기", "중계기", "표시", "발신기", "지구경종"], "high"),
  makeContent("09_contents_facility_alarm.json", 60, "FAC_ALARM_MANUAL_001", "소방전기시설의 구조 및 원리", "경보설비", "비상경보와 수동 조작", "수동 경보설비와 발신기 기준을 설명한다.", "비상경보설비, 발신기, 경종, 단독경보형감지기는 사람이 직접 조작하거나 즉시 경보를 발하는 장치다.", "자동으로 감지하는 설비와 사람이 누르는 설비를 나누어 봐야 한다.", "수동 경보 = 발신기 + 경종 + 조작", "수동 조작 거리, 설치 위치, 정지기능 문제가 자주 나온다.", "자동식 설비와 수동식 설비를 같은 기준으로 보면 오답이 생긴다.", "수동 경보설비는 조작 주체와 설치 기준을 함께 기억해야 한다.", ["비상경보", "발신기", "경종", "단독경보형감지기"], "medium"),
  makeContent("09_contents_facility_alarm.json", 61, "FAC_ALARM_BROADCAST_001", "소방전기시설의 구조 및 원리", "경보설비", "비상방송설비", "비상방송설비 배선과 음향장치 기준을 정리한다.", "비상방송설비는 확성기, 음향장치, 배선 기준을 통해 피난 지시를 전달하는 설비다.", "화재 시 안내 방송이 어디까지 들려야 하는지를 기준으로 본다.", "비상방송 = 확성기 거리 + 배선 기준", "층별 설치와 수평거리 기준을 계산 문제처럼 내는 경우가 많다.", "음향장치와 확성기 기준을 섞어 외우면 틀린다.", "비상방송설비는 전달 범위와 배선 안정성 기준이 핵심이다.", ["비상방송", "확성기", "음향장치", "배선"], "high"),
  makeContent("09_contents_facility_alarm.json", 62, "FAC_ALARM_REPORT_001", "소방전기시설의 구조 및 원리", "경보설비", "자동화재속보와 시각경보", "속보기와 시각경보장치 기준을 정리한다.", "자동화재속보설비는 화재신호를 외부에 자동 통보하고, 시각경보장치는 청각 외 방식으로 경보를 전달한다.", "소방서에 신호를 보내거나 빛으로 알려 주는 설비다.", "속보기 = 자동 통보, 시각경보 = 시각 전달", "속보 횟수, 작동 시간, 연동 조건 문제가 반복된다.", "일반 경보설비와 자동속보설비를 같은 개념으로 보면 틀린다.", "속보설비는 통보 기능과 성능기준을 함께 기억해야 한다.", ["자동화재속보", "속보기", "시각경보장치", "20초"], "medium"),
  makeContent("09_contents_facility_alarm.json", 63, "FAC_ALARM_LEAK_001", "소방전기시설의 구조 및 원리", "경보설비", "누전경보기", "누전경보기의 구조와 기준을 정리한다.", "누전경보기는 누설전류를 검출해 전기화재 위험을 경보하는 장치로, 공칭 작동전류와 설치방법이 중요하다.", "전기가 새는 상태를 빨리 찾아 경고해 주는 설비다.", "누전경보기 = 누설전류 검출 + 작동값", "작동전류와 감도조정 범위를 묻는 문제가 많다.", "누전차단기와 누전경보기를 같은 장치처럼 보면 틀린다.", "누전경보기 문제는 검출 원리와 기준 수치를 함께 정리해야 한다.", ["누전경보기", "작동전류", "감도조정", "누설전류"], "high"),
  makeContent("09_contents_facility_alarm.json", 64, "FAC_ALARM_COMM_001", "소방전기시설의 구조 및 원리", "통신·보조설비", "무선통신보조설비와 보조장치", "통신 보조설비 기준을 설명한다.", "무선통신보조설비와 관련 보조장치는 재난 현장에서 통신을 안정적으로 유지하기 위한 설비다.", "소방대가 건물 안에서도 통신이 끊기지 않게 돕는 장치다.", "통신보조 = 증폭기 + 배선 + 비상전원", "증폭기 비상전원과 배선 기준을 묻는 문제가 자주 나온다.", "경보설비와 통신보조설비를 같은 설비군처럼 보면 틀린다.", "통신 보조설비는 통신 목적과 비상전원 기준을 함께 봐야 한다.", ["무선통신보조설비", "증폭기", "비상전원", "금속제 외함"], "medium"),

  makeContent("10_contents_facility_evac_power.json", 65, "FAC_EGRESS_EXIT_001", "소방전기시설의 구조 및 원리", "피난설비", "유도등과 피난 안내", "유도등 종류와 설치기준을 정리한다.", "통로유도등, 객석유도등, 피난구유도등은 피난 방향을 안내하는 대표 설비다.", "어디로 도망가야 하는지를 불빛으로 알려 주는 장치다.", "유도등 = 종류 + 설치 간격", "설치 거리와 배치 기준을 자주 숫자로 묻는다.", "유도등 종류를 헷갈리면 설치 장소 문제에서 틀린다.", "유도등 문제는 설치 장소와 간격 수치를 함께 기억해야 한다.", ["유도등", "통로유도등", "객석유도등", "피난구유도등"], "high"),
  makeContent("10_contents_facility_evac_power.json", 66, "FAC_EGRESS_LIGHT_001", "소방전기시설의 구조 및 원리", "피난설비", "비상조명등", "비상조명등의 작동시간과 설치대상을 정리한다.", "비상조명등은 정전이나 화재 시 피난 경로를 확보하기 위한 설비로, 작동시간과 대상물 기준이 중요하다.", "불이 꺼져도 탈출할 수 있게 길을 비춰 주는 장치다.", "비상조명 = 작동시간 + 설치대상", "60분 기준과 예외 대상을 묻는 문제가 많다.", "유도등과 비상조명등을 같은 설비로 보면 틀린다.", "비상조명등은 조도보다 작동시간과 적용 대상을 중심으로 정리해야 한다.", ["비상조명등", "60분", "작동시간"], "medium"),
  makeContent("10_contents_facility_evac_power.json", 67, "FAC_POWER_SOCKET_001", "소방전기시설의 구조 및 원리", "소화활동설비", "비상콘센트설비", "비상콘센트의 설치와 배선 기준을 설명한다.", "비상콘센트설비는 소방활동 전원을 제공하는 설비로, 회로 수, 설치 위치, 보호함 기준이 중요하다.", "화재 때 소방대가 전기를 끌어다 쓰는 콘센트라고 보면 된다.", "비상콘센트 = 회로 수 + 설치 위치 + 보호함", "층별 개수와 전용회로 기준을 묻는 문제가 자주 나온다.", "일반 콘센트 기준처럼 접근하면 설치 기준을 틀리기 쉽다.", "비상콘센트설비는 현장 사용 목적과 회로 기준을 함께 봐야 한다.", ["비상콘센트", "전용회로", "보호함", "전압별"], "high"),
  makeContent("10_contents_facility_evac_power.json", 68, "FAC_POWER_SOURCE_001", "소방전기시설의 구조 및 원리", "전원설비", "비상전원과 배선", "비상전원의 종류와 용량 기준을 정리한다.", "축전지설비, 자가발전설비, 예비전원은 소방설비를 정전 시에도 작동시키기 위한 전원 체계다.", "화재 때도 설비가 꺼지지 않도록 하는 전기 백업 체계다.", "비상전원 = 종류 + 지속시간 + 배선", "어느 설비를 몇 분 이상 작동해야 하는지 묻는 수치형 문제가 많다.", "비상전원과 상용전원 기준을 섞으면 틀린다.", "비상전원 문제는 대상 설비와 지속시간을 함께 묶어 외워야 한다.", ["비상전원", "축전지", "자가발전", "예비전원", "작동시간"], "high"),
  makeContent("10_contents_facility_evac_power.json", 69, "FAC_SMOKE_CONTROL_001", "소방전기시설의 구조 및 원리", "소화활동설비", "제연설비", "제연설비의 전원과 기준을 설명한다.", "제연설비는 연기를 제어해 피난과 소방활동을 돕는 설비로, 비상전원과 설치 기준이 핵심이다.", "연기를 빼내거나 막아서 피난 가능 시간을 늘리는 설비다.", "제연설비 = 연기 제어 + 비상전원", "작동시간과 설치 대상물 기준이 반복 출제된다.", "제연과 환기를 같은 개념처럼 보면 법규 적용이 틀어진다.", "제연설비는 피난 목적과 전원 기준을 함께 이해해야 한다.", ["제연설비", "연기", "비상전원", "작동시간"], "medium"),
  makeContent("10_contents_facility_evac_power.json", 70, "FAC_SUPPRESSION_POWER_001", "소방전기시설의 구조 및 원리", "소화설비 연동", "소화설비 전기연동과 구동", "프리액션·옥내소화전 등 구동회로를 정리한다.", "옥내소화전, 프리액션밸브, 솔레노이드, 펌프 기동회로는 소화설비의 전기적 연동을 구성한다.", "소화설비가 언제 어떻게 전기적으로 움직이는지를 보는 파트다.", "소화설비 연동 = 기동 신호 + 구동 전원", "전압강하나 구동전류를 계산하는 문제와 연동 조건 문제가 함께 나온다.", "기계설비 문제처럼 접근하면 전기 연동 포인트를 놓친다.", "소화설비 연동 문제는 기동조건과 전원 회로를 동시에 봐야 한다.", ["옥내소화전", "프리액션", "솔레노이드", "전압강하", "펌프"], "medium")
];

const subjectRules = {
  "소방전기회로": [
    rule("EC_CTRL_TRANSFER_001", /(전달함수|블록선도|부궤환|정궤환|피드백|루프 이득|근궤적|보드선도|나이퀴스트)/),
    rule("EC_CTRL_SEQUENCE_001", /(시퀀스|릴레이|계전기|자기유지|인터록|타이머|전자접촉기|접점)/),
    rule("EC_CTRL_LOGIC_001", /(논리회로|논리식|불대수|게이트|진리표|NAND|NOR|XOR|무접점회로|AND| OR | NOT )/),
    rule("EC_CTRL_SEMICON_001", /(다이오드|트랜지스터|사이리스터|SCR|정류회로|반파 정류|전파 정류|제너|증폭기|반도체)/),
    rule("EC_CTRL_SENSORS_001", /(서미스터|열전대|초전재료|PZT|센서|검출소자|온도감지용)/),
    rule("EC_CTRL_CONTROL_BASIC_001", /(제어량|자동제어|서보기구|프로세스|외란|PD\(|PI\(|PID|비례 미분|비례적분|미분제어|온도, 유량, 압력|공업 프로세스)/),
    rule("EC_BASIC_INDUCTION_001", /(유도기전력|전자유도|인덕턴스|코일|패러데이|렌츠|상호유도)/),
    rule("EC_BASIC_THREE_PHASE_001", /(3상|삼상|Y결선|Δ결선|델타결선|성형결선|선전류|상전압|선간전압)/),
    rule("EC_BASIC_POWER_FACTOR_001", /(역률|유효전력|무효전력|피상전력|전력계|와트미터|전력량은|무효전력\(Var\)|역률이)/),
    rule("EC_BASIC_AC_001", /(정현파|주파수|위상|실효값|리액턴스|임피던스|교류회로|사인파|cos|sin|교류전압)/),
    rule("EC_BASIC_MAGNETIC_001", /(자속|자장|자속밀도|투자율|자계|자성체|자기회로|자기저항|자화)/),
    rule("EC_BASIC_CAPACITOR_001", /(콘덴서|정전용량|유전체|축전기|커패시터|전기용량)/),
    rule("EC_BASIC_NETWORK_001", /(키르히호프|중첩|테브난|노튼|회로망|브리지회로|밀만)/),
    rule("EC_BASIC_MATERIAL_MEASURE_001", /(절연체|도체|도전율|반도체의 저항값|전류계|전압계|계기|측정 범위|병렬로 연결|직렬로 연결|온도와의 관계|과전류차단기|KEC|전압의 구분|정상 전류밀도|공간 전하밀도)/),
    fallback("EC_BASIC_DC_LAW_001")
  ],
  "소방관계법규": [
    rule("LAW_BUILDING_APPROVAL_001", /(건축허가|동의요구|동의여부|회신|소방특별조사|연기신청|통보하여야)/),
    rule("LAW_SAFETY_MANAGER_001", /(소방안전관리자|소방안전관리대상물|자체점검|작동점검|종합정밀점검|한국소방안전|소방안전원)/),
    rule("LAW_FIRE_BUSINESS_001", /(소방시설공사업|공사업자|관리업자|소방시설관리업|전문 소방시설 공사업|기술인력|등록기준|영업범위)/),
    rule("LAW_FIRE_FACILITY_CLASS_001", /(소화활동설비|소화설비|경보설비|피난설비|소방용수시설|특정소방대상물|자동식소화기|수동식소화기|간이소화용구)/),
    rule("LAW_HAZARD_TANK_001", /(지하탱크|옥외탱크|방유제|매설|주유관의 길이|안전거리|탱크는 본체 윗부분)/),
    rule("LAW_HAZARD_LOCATION_001", /(제조소등|제조소의|저장소|취급소|주유취급소|판매취급소|지하암반저장소)/),
    rule("LAW_HAZARD_SIGN_001", /(표지|문자의 색|바탕 및 문자|게시판)/),
    rule("LAW_HAZARD_INSPECTION_001", /(자체소방대|정기점검|예방규정|점검의 대상인 제조소등)/),
    rule("LAW_HAZARD_CLASS_001", /(제1류|제2류|제3류|제4류|제5류|제6류|위험물|산화성고체|인화성액체|지정수량|경유의 지정수량)/),
    rule("LAW_SPECIAL_TARGET_001", /(특수장소|위락시설|공업지역|아파트로서|특정소방대상물)/),
    rule("LAW_FIRE_COMMAND_001", /(소방본부장|소방서장은|소방활동구역|화재의 조사활동|명령을 할 수 있는데|소방대라 함은)/),
    fallback("LAW_BASIC_FRAME_001")
  ],
  "소방전기시설의 구조 및 원리": [
    rule("FAC_POWER_SOCKET_001", /(비상콘센트)/),
    rule("FAC_ALARM_BROADCAST_001", /(비상방송설비|확성기|음향장치)/),
    rule("FAC_ALARM_REPORT_001", /(자동화재속보설비|속보기|시각경보장치)/),
    rule("FAC_ALARM_LEAK_001", /(누전경보기|누설전류)/),
    rule("FAC_ALARM_COMM_001", /(무선통신보조설비|증폭기|금속제 외함)/),
    rule("FAC_SMOKE_CONTROL_001", /(제연설비)/),
    rule("FAC_EGRESS_EXIT_001", /(유도등|피난구유도등|통로유도등|객석유도등)/),
    rule("FAC_EGRESS_LIGHT_001", /(비상조명등)/),
    rule("FAC_POWER_SOURCE_001", /(비상전원|축전지설비|자가발전설비|예비전원)/),
    rule("FAC_SUPPRESSION_POWER_001", /(옥내소화전|프리액션|솔레노이드|전압강하|소화설비반|펌프)/),
    rule("FAC_ALARM_RECEIVER_001", /(수신기|중계기|발신기|지구경종|표시등|도통시험)/),
    rule("FAC_ALARM_SMOKE_001", /(연기감지기|광전식|이온화식|분리형 감지기|감광면적)/),
    rule("FAC_ALARM_FLAME_001", /(불꽃감지기|적외선|자외선|초전재료|PZT)/),
    rule("FAC_ALARM_HEAT_001", /(정온식|차동식|보상식|열전대식|열반도체식|공기팽창|금속팽창|주위온도가 일정한 온도상승율|주위온도가 일정한 온도 이상)/),
    rule("FAC_ALARM_MANUAL_001", /(비상경보설비|단독경보형감지기)/),
    fallback("FAC_ALARM_SYSTEM_001")
  ]
};

async function main() {
  const questionPath = path.join(learningDir, "11_questions_past_exam.json");
  const mapPath = path.join(learningDir, "12_content_question_map.json");
  const memoryCardPath = path.join(learningDir, "30_memory_cards.json");
  const blankQuizPath = path.join(learningDir, "31_blank_quizzes.json");
  const reportPath = path.join(learningDir, "validation_report.json");

  const questions = await readJson(questionPath);
  const existingMapItems = await readJson(mapPath);
  const existingContents = sortByLearningOrder(await loadContentFiles(learningDir));

  const contentsByFile = new Map();
  for (const definition of contentDefinitions) {
    const { fileName, ...rest } = definition;
    const content = {
      ...rest,
      schema_version: SCHEMA_VERSION,
      review_cycle: REVIEW_CYCLE,
      status: "published"
    };
    const bucket = contentsByFile.get(fileName) || [];
    bucket.push(content);
    contentsByFile.set(fileName, bucket);
  }

  for (const [fileName, items] of contentsByFile) {
    await writeJson(path.join(learningDir, fileName), items);
  }

  const allContents = sortByLearningOrder([...(await loadContentFiles(learningDir))]);
  const contentById = new Map(allContents.map((content) => [content.content_id, content]));
  const alreadyMappedQuestionIds = new Set(existingMapItems.map((item) => item.question_id));
  const orderByContentId = new Map();
  for (const item of existingMapItems) {
    orderByContentId.set(item.content_id, Math.max(orderByContentId.get(item.content_id) || 0, item.order_no || 0));
  }

  const newMapItems = [];
  const sourceQuestionIdsByContentId = new Map();
  for (const item of existingMapItems) {
    const current = sourceQuestionIdsByContentId.get(item.content_id) || [];
    current.push(item.question_id);
    sourceQuestionIdsByContentId.set(item.content_id, current);
  }

  for (const question of questions) {
    if (alreadyMappedQuestionIds.has(question.question_id)) {
      continue;
    }
    const contentId = matchContentId(question);
    const nextOrder = (orderByContentId.get(contentId) || 0) + 1;
    orderByContentId.set(contentId, nextOrder);
    newMapItems.push({
      schema_version: SCHEMA_VERSION,
      content_id: contentId,
      question_id: question.question_id,
      relation_type: "source_exam",
      order_no: nextOrder,
      status: "published",
      source_date: question.source_date,
      source_question_no: question.source_question_no,
      needs_review: !!question.needs_review
    });
    const current = sourceQuestionIdsByContentId.get(contentId) || [];
    current.push(question.question_id);
    sourceQuestionIdsByContentId.set(contentId, current);
  }

  const mergedMapItems = [...existingMapItems, ...newMapItems].sort((left, right) =>
    left.question_id.localeCompare(right.question_id)
  );
  await writeJson(mapPath, mergedMapItems);

  const updatedQuestions = questions.map((question) => {
    const mappedItem = mergedMapItems.find((item) => item.question_id === question.question_id);
    const mappedContent = mappedItem ? contentById.get(mappedItem.content_id) : null;
    if (!mappedContent) {
      return question;
    }
    return {
      ...question,
      chapter: mappedContent.chapter,
      topic: mappedContent.topic,
      exam_point: mappedContent.memory_point,
      tags: unique([question.subject, mappedContent.chapter, mappedContent.topic, ...(question.tags || [])])
    };
  });
  await writeJson(questionPath, updatedQuestions);

  const refreshedContents = allContents.map((content) => enrichContent(content, sourceQuestionIdsByContentId, updatedQuestions));
  const refreshedByFile = new Map();
  for (const content of refreshedContents) {
    const fileName = fileForContentId(content.content_id);
    const bucket = refreshedByFile.get(fileName) || [];
    bucket.push(content);
    refreshedByFile.set(fileName, bucket);
  }
  for (const [fileName, items] of refreshedByFile) {
    await writeJson(path.join(learningDir, fileName), sortByLearningOrder(items));
  }

  const memoryCards = refreshedContents.map((content) => ({
    memory_card_id: `MC_${content.content_id}`,
    content_id: content.content_id,
    subject: content.subject,
    chapter: content.chapter,
    topic: content.topic,
    front: content.topic,
    back: content.memory_point,
    hint: content.summary,
    tags: content.tags || [],
    schema_version: SCHEMA_VERSION,
    status: "published"
  }));
  const blankQuizzes = refreshedContents.map((content) => ({
    blank_quiz_id: `BQ_${content.content_id}`,
    content_id: content.content_id,
    subject: content.subject,
    chapter: content.chapter,
    topic: content.topic,
    prompt: `${content.memory_point} / 핵심 개념: ____`,
    answer: content.topic,
    acceptable_answers: [content.topic],
    hint: content.summary,
    schema_version: SCHEMA_VERSION,
    status: "published"
  }));
  await writeJson(memoryCardPath, memoryCards);
  await writeJson(blankQuizPath, blankQuizzes);

  const report = await readJson(reportPath);
  report.content_count = refreshedContents.length;
  report.content_question_map_count = mergedMapItems.length;
  report.memory_cards_count = memoryCards.length;
  report.blank_quizzes_count = blankQuizzes.length;
  await writeJson(reportPath, report);

  const summary = buildSummary(refreshedContents, sourceQuestionIdsByContentId);
  console.log(JSON.stringify(summary, null, 2));
}

function makeContent(fileName, learningOrder, contentId, subject, chapter, topic, learningGoal, conceptCore, conceptEasy, memoryPoint, fieldNote, commonTrap, summary, tags, examFrequency) {
  return {
    fileName,
    content_id: contentId,
    subject,
    chapter,
    topic,
    level: learningOrder < 40 ? "basic" : learningOrder < 60 ? "intermediate" : "basic",
    learning_order: learningOrder,
    title: topic,
    learning_goal: learningGoal,
    concept_core: conceptCore,
    concept_easy: conceptEasy,
    memory_point: memoryPoint,
    field_note: fieldNote,
    common_trap: commonTrap,
    summary,
    estimated_minutes: 5,
    exam_frequency: examFrequency,
    needs_review_count: 0,
    source_question_ids: [],
    source_question_count: 0,
    correct_rate_avg: null,
    tags: [subject, chapter, topic, examFrequency]
  };
}

function rule(contentId, pattern) {
  return { contentId, pattern };
}

function fallback(contentId) {
  return { contentId, pattern: null };
}

function matchContentId(question) {
  const rules = subjectRules[question.subject];
  if (!rules) {
    throw new Error(`No subject rules for ${question.subject}`);
  }
  const haystack = `${question.question_text}\n${question.explanation || ""}\n${question.answer_text || ""}`;
  for (const item of rules) {
    if (!item.pattern) {
      return item.contentId;
    }
    if (item.pattern.test(haystack)) {
      return item.contentId;
    }
  }
  return rules[rules.length - 1].contentId;
}

function enrichContent(content, sourceQuestionIdsByContentId, questions) {
  const ids = unique(sourceQuestionIdsByContentId.get(content.content_id) || []);
  const related = ids
    .map((id) => questions.find((question) => question.question_id === id))
    .filter(Boolean);
  const rates = related.map((item) => item.correct_rate).filter((value) => typeof value === "number");
  const needsReviewCount = related.filter((item) => item.needs_review).length;
  return {
    ...content,
    source_question_ids: ids,
    source_question_count: ids.length,
    correct_rate_avg: rates.length ? Number((rates.reduce((sum, value) => sum + value, 0) / rates.length).toFixed(1)) : null,
    exam_frequency: frequencyFromCount(ids.length),
    needs_review_count: needsReviewCount
  };
}

function frequencyFromCount(count) {
  if (count >= 35) {
    return "high";
  }
  if (count >= 15) {
    return "medium";
  }
  return "low";
}

function fileForContentId(contentId) {
  if (contentId.startsWith("EC_BASIC_")) {
    return "06_contents_electric_basic.json";
  }
  if (contentId.startsWith("EC_CTRL_")) {
    return "07_contents_electric_control.json";
  }
  if (contentId.startsWith("LAW_")) {
    return "08_contents_law.json";
  }
  if (contentId.startsWith("FAC_ALARM_")) {
    return "09_contents_facility_alarm.json";
  }
  if (contentId.startsWith("FAC_")) {
    return "10_contents_facility_evac_power.json";
  }
  if (contentId.startsWith("FIRE_")) {
    if (contentId.startsWith("FIRE_BASIC_")) {
      return "03_contents_fire_basic.json";
    }
    if (contentId.startsWith("FIRE_EXT_")) {
      return "04_contents_fire_extinguishing.json";
    }
    return "05_contents_fire_hazard_evacuation.json";
  }
  throw new Error(`Unsupported content id: ${contentId}`);
}

function buildSummary(contents, sourceQuestionIdsByContentId) {
  const byFile = {};
  for (const content of contents) {
    const fileName = fileForContentId(content.content_id);
    if (!byFile[fileName]) {
      byFile[fileName] = { count: 0, mappedQuestions: 0 };
    }
    byFile[fileName].count += 1;
    byFile[fileName].mappedQuestions += (sourceQuestionIdsByContentId.get(content.content_id) || []).length;
  }
  return {
    contentCount: contents.length,
    mapCount: [...sourceQuestionIdsByContentId.values()].reduce((sum, ids) => sum + ids.length, 0),
    byFile
  };
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
