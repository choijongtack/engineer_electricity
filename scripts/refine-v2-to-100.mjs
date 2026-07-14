import path from "node:path";
import {
  learningDir,
  loadContentFiles,
  readJson,
  sortByLearningOrder,
  unique,
  writeJson
} from "./data-pipeline-utils.mjs";

const SCHEMA_VERSION = "2.0-compatible-v1";
const REVIEW_CYCLE = ["D+1", "D+3", "D+7"];

const replacements = {
  EC_BASIC_DC_LAW_001: {
    remove: "06_contents_electric_basic.json",
    defs: [
      content("06_contents_electric_basic.json", 27, "EC_DC_OHM_001", "소방전기회로", "전기 기초", "옴의 법칙과 전류 계산", "옴의 법칙과 전류 계산을 정리한다.", "전압, 전류, 저항의 관계는 직류 계산의 출발점이다.", "V=IR만 정확히 적용해도 기본 계산형의 대부분이 풀린다.", "옴의 법칙과 전류 계산", "직렬·병렬 조건을 먼저 확인해야 한다.", "저항 조건을 놓치면 수치만 맞춰도 오답이 된다.", "직류 회로 계산은 옴의 법칙 적용이 출발점이다.", "medium"),
      content("06_contents_electric_basic.json", 28, "EC_DC_POWER_001", "소방전기회로", "전기 기초", "전력·전력량 계산", "전력과 전력량 계산을 구분한다.", "전력, 전력량, 효율 계산은 직류 회로에서 반복되는 출제 포인트다.", "W와 kWh를 구분해서 보는 습관이 필요하다.", "전력과 전력량 계산", "단위 변환을 같이 묻는 경우가 많다.", "전력과 전력량을 같은 값으로 보면 틀린다.", "전력 문제는 단위와 시간을 함께 봐야 한다.", "medium"),
      content("06_contents_electric_basic.json", 29, "EC_DC_RESISTANCE_001", "소방전기회로", "전기 기초", "합성저항과 분압·분류", "합성저항과 전류 분배를 정리한다.", "직렬·병렬 저항, 분압, 분류는 회로 해석의 기본이다.", "회로를 단순화하는 능력이 계산 속도를 만든다.", "합성저항과 분압·분류", "브리지나 병렬 회로에서 자주 반복된다.", "공식을 외워도 연결 형태를 잘못 읽으면 오답이 된다.", "합성저항 문제는 회로 단순화가 먼저다.", "high"),
      content("06_contents_electric_basic.json", 30, "EC_DC_SOURCE_BATT_001", "소방전기회로", "전기 기초", "전원·축전지·기동 특성", "전원 특성과 축전지 기초를 정리한다.", "단자전압, 내부저항, 축전지, 기동 특성은 전원 관련 기본 개념이다.", "전원이 이상적이지 않다는 점을 이해해야 풀이가 안정된다.", "단자전압과 축전지 특성", "내부저항과 기동 특성을 섞어 출제한다.", "전원 특성을 저항 계산과 같은 축으로만 보면 틀린다.", "전원 문제는 내부저항과 축전지 특성을 같이 봐야 한다.", "medium")
    ],
    rules: [
      match("EC_DC_SOURCE_BATT_001", /(단자전압|축전지|내부저항|알칼리 축전지|전지|기동토크|기동법|전동기중 기동|최대전력)/),
      match("EC_DC_POWER_001", /(kWh|전력량|전력은|손실|소비전력|효율)/),
      match("EC_DC_RESISTANCE_001", /(합성저항|브리지|분류기|분류|병렬|직렬|저항단자|ab간|a-b간)/),
      fallback("EC_DC_OHM_001")
    ]
  },
  EC_BASIC_AC_001: {
    remove: "06_contents_electric_basic.json",
    defs: [
      content("06_contents_electric_basic.json", 32, "EC_AC_WAVE_001", "소방전기회로", "교류 회로", "정현파와 파형 기본량", "정현파의 기본량을 정리한다.", "최대값, 실효값, 평균값, 파고율은 교류 파형 해석의 기본값이다.", "값이 무엇을 기준으로 한 것인지부터 확인해야 한다.", "정현파 기본량", "평균값과 실효값을 비교하는 문제가 많다.", "최대값과 실효값을 바꿔 쓰면 계산이 무너진다.", "교류 파형 문제는 기준값 구분이 핵심이다.", "medium"),
      content("06_contents_electric_basic.json", 33, "EC_AC_PHASE_FREQ_001", "소방전기회로", "교류 회로", "주파수와 위상차", "주파수와 위상차를 시간축으로 해석한다.", "주파수, 각속도, 위상차는 정현파를 시간축에서 읽게 해 주는 핵심 요소다.", "각도와 시간을 오갈 수 있어야 한다.", "주파수와 위상차", "위상차를 시간으로 바꾸는 문제가 반복된다.", "라디안과 시간 관계를 놓치면 오답이 생긴다.", "교류는 시간축 해석이 중요하다.", "medium"),
      content("06_contents_electric_basic.json", 34, "EC_AC_RLC_001", "소방전기회로", "교류 회로", "RLC와 임피던스 계산", "리액턴스와 임피던스 계산을 정리한다.", "R, L, C가 섞인 회로에서는 임피던스와 어드미턴스 해석이 핵심이다.", "실수부와 허수부를 분리해 읽어야 한다.", "RLC 임피던스 계산", "직렬·병렬 RLC 계산이 자주 나온다.", "리액턴스 부호를 잘못 두면 결과가 완전히 바뀐다.", "RLC 회로는 임피던스 표현이 핵심이다.", "high"),
      content("06_contents_electric_basic.json", 35, "EC_AC_MACHINE_001", "소방전기회로", "교류 회로", "교류기기와 변환회로", "교류기기와 인버터 기초를 정리한다.", "교류 브리지, 인버터, 동기발전기 병렬조건 등은 교류 응용 파트의 대표 주제다.", "순수 계산보다 기기 동작 조건을 이해해야 한다.", "교류기기와 변환회로", "브리지 평형조건과 병렬운전 조건이 자주 나온다.", "교류 파형 문제와 기기 조건 문제를 같은 방식으로 풀면 틀린다.", "교류 응용은 기기 조건 이해가 필요하다.", "medium")
    ],
    rules: [
      match("EC_AC_MACHINE_001", /(인버터|동기발전기|배전반|브리지의 평형조건|교류브리지|병렬조건)/),
      match("EC_AC_RLC_001", /(리액턴스|임피던스|어드미턴스|R-L-C|직렬회로|전압계 ⓥ|교류전압 100V|전류는 몇 A)/),
      match("EC_AC_PHASE_FREQ_001", /(위상차|60\[Hz\]|377t|주파수는 몇|시간으로 표시)/),
      fallback("EC_AC_WAVE_001")
    ]
  },
  EC_BASIC_MATERIAL_MEASURE_001: {
    remove: "06_contents_electric_basic.json",
    defs: [
      content("06_contents_electric_basic.json", 36, "EC_MEASURE_METER_001", "소방전기회로", "전기 기초", "전류계·전압계 확장", "계기의 배율기·분류기 원리를 정리한다.", "전압계와 전류계의 측정 범위 확대는 배율기와 분류기로 이뤄진다.", "계기 내부저항과 외부 저항의 역할을 구분해야 한다.", "계기 확장 원리", "배율과 분류 계산이 반복된다.", "직렬·병렬 연결을 반대로 기억하면 바로 틀린다.", "계기 문제는 연결 방식이 핵심이다.", "medium"),
      content("06_contents_electric_basic.json", 37, "EC_MEASURE_METHOD_001", "소방전기회로", "전기 기초", "측정법과 표준량", "직접측정과 비교측정 개념을 구분한다.", "측정 방법은 표준량과 비교 방식에 따라 종류가 나뉘며 정밀도와 감도가 달라진다.", "무엇과 비교해서 재는지 이해하면 정리가 쉽다.", "측정법과 표준량", "정밀측정과 감도 기준을 묻는 문제가 나온다.", "측정량과 표준량 관계를 놓치면 정의 문제가 틀린다.", "측정법은 정의형 문제의 핵심이다.", "low"),
      content("06_contents_electric_basic.json", 38, "EC_MATERIAL_CONDUCTOR_001", "소방전기회로", "전기 기초", "도체·절연체·전해질", "재료의 도전 특성을 정리한다.", "도체, 절연체, 전해질, 반도체는 전류 전달 방식이 다르다.", "무엇이 전기를 잘 통하는지부터 정확히 구분해야 한다.", "재료의 도전 특성", "전해액 도전율과 물질 분류가 함께 나온다.", "반도체와 전해질 특성을 섞어 기억하면 오답이 생긴다.", "재료 특성은 분류가 중요하다.", "medium"),
      content("06_contents_electric_basic.json", 39, "EC_RULE_PROTECT_001", "소방전기회로", "전기 기초", "전압 구분과 보호기준", "전압 구분과 과전류 보호기준을 정리한다.", "KEC 전압 구분과 과전류차단기 기준은 규정형 문제의 대표 축이다.", "수치와 분류 기준을 함께 외워야 한다.", "전압 구분과 보호기준", "규정 수치를 직접 묻는 문제가 많다.", "기능만 기억하고 수치를 놓치면 틀린다.", "규정형 문제는 분류와 수치를 함께 기억해야 한다.", "medium")
    ],
    rules: [
      match("EC_RULE_PROTECT_001", /(KEC|전압의 구분|과전류차단기|옥내간선)/),
      match("EC_MEASURE_METER_001", /(전류계|전압계|배율기|분류기|내부저항|최대눈금|측정범위를)/),
      match("EC_MEASURE_METHOD_001", /(측정량|표준량|정밀측정|비교측정|측정 방법)/),
      fallback("EC_MATERIAL_CONDUCTOR_001")
    ]
  },
  EC_CTRL_SEMICON_001: {
    remove: "07_contents_electric_control.json",
    defs: [
      content("07_contents_electric_control.json", 43, "EC_SEMI_DIODE_001", "소방전기회로", "전자 회로", "다이오드와 정류회로", "다이오드와 정류 기본을 정리한다.", "다이오드는 정류의 핵심 소자이며 평균전압과 역전압 계산이 반복 출제된다.", "한 방향 전류 제어라는 성격부터 잡아야 한다.", "다이오드와 정류회로", "역전압과 평균전압 계산이 많다.", "정류 종류를 섞으면 결과가 달라진다.", "정류회로는 다이오드 성질이 핵심이다.", "high"),
      content("07_contents_electric_control.json", 44, "EC_SEMI_TRANSISTOR_001", "소방전기회로", "전자 회로", "트랜지스터와 증폭", "트랜지스터와 증폭 동작을 정리한다.", "트랜지스터는 증폭과 스위칭의 기본 소자로 α, β 관계가 자주 출제된다.", "전류를 키우는 구조로 보면 이해가 쉽다.", "트랜지스터와 증폭", "접지방식과 차단전류 문제가 나온다.", "다이오드와 역할을 혼동하면 틀린다.", "트랜지스터는 증폭 개념이 핵심이다.", "medium"),
      content("07_contents_electric_control.json", 45, "EC_SEMI_IC_SENSOR_001", "소방전기회로", "전자 회로", "집적회로와 광반도체", "IC와 광반도체 소자를 구분한다.", "집적회로, 광다이오드 등은 기능 중심으로 구분하는 대표 소자다.", "무슨 기능을 하는 소자인지부터 보면 된다.", "IC와 광반도체", "광센서와 집적회로 정의형 문제가 나온다.", "소자 이름만 외우면 응용 문제에서 흔들린다.", "기능 중심 구분이 중요하다.", "low"),
      content("07_contents_electric_control.json", 46, "EC_SEMI_MATERIAL_001", "소방전기회로", "전자 회로", "반도체 재료와 온도특성", "진성반도체와 온도특성을 정리한다.", "페르미 준위, 온도특성, 도체·반도체 구분은 재료 기초의 핵심이다.", "소자보다 재료 성질을 묻는 파트다.", "반도체 재료와 온도특성", "온도에 따른 저항 변화 문제가 반복된다.", "재료 특성과 회로 특성을 혼동하면 틀린다.", "재료 파트는 정의형으로 정리해야 한다.", "medium")
    ],
    rules: [
      match("EC_SEMI_TRANSISTOR_001", /(트랜지스터|베이스접지|이미터접지|컬렉터|증폭기기가 아닌 것은|정전압회로에서 Q1)/),
      match("EC_SEMI_IC_SENSOR_001", /(실리콘속에|집적회로|광센서|빛이 닿으면|광량의 변화)/),
      match("EC_SEMI_MATERIAL_001", /(진성반도체|페르미 준위|절연체가 아닌|도체는 어느 것|온도와의 관계)/),
      fallback("EC_SEMI_DIODE_001")
    ]
  },
  LAW_BASIC_FRAME_001: {
    remove: "08_contents_law.json",
    defs: [
      content("08_contents_law.json", 53, "LAW_FRAME_PURPOSE_001", "소방관계법규", "총칙", "법 목적과 기본용어", "법 목적과 기본용어를 정리한다.", "총칙 문제는 목적과 기본 정의를 정확히 읽는 능력이 중요하다.", "법이 왜 존재하는지와 핵심 용어를 먼저 잡아야 한다.", "법 목적과 기본용어", "문구 차이형 선택지가 많다.", "비슷한 표현을 같은 뜻으로 보면 틀린다.", "총칙은 문구 정확도가 중요하다.", "medium"),
      content("08_contents_law.json", 54, "LAW_FRAME_SIGNAL_001", "소방관계법규", "소방기본법", "소방신호와 경계지구", "소방신호와 화재경계지구 기준을 정리한다.", "소방신호의 종류와 화재경계지구 지정은 기본법 파트의 대표 암기 포인트다.", "현장 운영 신호와 지정 지역 개념을 묶어 봐야 한다.", "소방신호와 경계지구", "신호 종류와 지정 대상 지역을 자주 묻는다.", "이름만 외우고 지정 목적을 놓치면 틀린다.", "운영형 총칙 파트다.", "medium"),
      content("08_contents_law.json", 55, "LAW_FRAME_INSPECTION_001", "소방관계법규", "소방행정", "검사·출입·벌칙 기본", "검사와 출입·벌칙 기본을 정리한다.", "검사, 자료제출, 출입, 방해 금지와 관련한 벌칙은 행정형 출제 포인트다.", "누가 조사하고 거부하면 어떤 책임이 따르는지를 묻는다.", "검사·출입·벌칙 기본", "벌칙 수준과 행위 유형을 결합해 낸다.", "행정 행위와 벌칙을 분리해 기억하면 흔들린다.", "행정 집행 파트의 기본이다.", "medium"),
      content("08_contents_law.json", 56, "LAW_FRAME_SUPPORT_001", "소방관계법규", "소방행정", "상호응원·보조·성능승인", "상호응원과 지원제도를 정리한다.", "상호응원협정, 국고보조, 형식승인, 성능시험은 소방행정 지원체계의 대표 주제다.", "행정적 지원과 승인 절차를 묻는 파트다.", "상호응원·보조·승인", "협정 사항과 승인 권한을 자주 묻는다.", "지원 제도와 현장 대응을 같은 축으로 보면 틀린다.", "행정 지원 구조를 보는 파트다.", "medium")
    ],
    rules: [
      match("LAW_FRAME_SIGNAL_001", /(소방신호|화재경계지구)/),
      match("LAW_FRAME_INSPECTION_001", /(검사|자료를 제출하지|출입|방해|기피|벌칙|관계공무원)/),
      match("LAW_FRAME_SUPPORT_001", /(상호 응원협정|국고보조금|성능시험|형식승인|검정의 중지|시정조치)/),
      fallback("LAW_FRAME_PURPOSE_001")
    ]
  },
  LAW_FIRE_FACILITY_CLASS_001: {
    remove: "08_contents_law.json",
    defs: [
      content("08_contents_law.json", 57, "LAW_FCLASS_EXTINGUISH_001", "소방관계법규", "소방시설 기준", "소화기구와 소화설비 설치대상", "소화기구와 소화설비 설치대상을 정리한다.", "소화기구, 자동식소화기, 소화설비 설치 기준은 기본 빈출 영역이다.", "무슨 건물에 어떤 소화설비가 필요한지 보는 파트다.", "소화기구와 소화설비", "연면적·층수 기준을 함께 묻는다.", "소화기구와 소화활동설비를 섞으면 틀린다.", "설치대상 분류의 핵심이다.", "high"),
      content("08_contents_law.json", 58, "LAW_FCLASS_ALARM_001", "소방관계법규", "소방시설 기준", "경보설비 설치대상", "경보설비 설치대상을 정리한다.", "비상경보설비, 자동화재탐지설비, 경보설비 면제 기준은 대표 법규 주제다.", "경보가 필요한 대상물을 정리하는 파트다.", "경보설비 설치대상", "면제 기준까지 함께 묻는 문제가 많다.", "설치와 면제 기준을 바꿔 기억하면 틀린다.", "경보설비 법규의 핵심이다.", "high"),
      content("08_contents_law.json", 59, "LAW_FCLASS_WATER_SMOKE_001", "소방관계법규", "소방시설 기준", "소방용수시설과 제연설비", "소방용수와 제연설비 기준을 정리한다.", "소방용수시설, 수원, 제연설비 설치 기준은 수치형 출제가 많은 영역이다.", "거리, 낙차, 대상물 기준을 함께 봐야 한다.", "소방용수시설과 제연설비", "거리·면적 수치가 자주 나온다.", "소방용수와 소화활동설비를 섞으면 헷갈린다.", "수치형 법규 파트다.", "medium"),
      content("08_contents_law.json", 60, "LAW_FCLASS_CATEGORY_001", "소방관계법규", "소방시설 기준", "소방시설 분류 체계", "소방시설의 분류 체계를 정리한다.", "경보설비, 피난설비, 소화활동설비 등 소방시설의 군 분류는 전체 법규의 기초다.", "설비 이름을 보고 어느 군에 속하는지 판단해야 한다.", "소방시설 분류 체계", "비슷한 설비를 다른 군으로 바꿔 내는 문제가 많다.", "이름만 보고 찍으면 오답이 많다.", "시설군 분류의 기본이다.", "medium")
    ],
    rules: [
      match("LAW_FCLASS_WATER_SMOKE_001", /(소방용수시설|수원|저수조|낙차|제연설비)/),
      match("LAW_FCLASS_ALARM_001", /(경보설비|자동화재탐지설비|비상경보설비|면제 받을 수 없는|면제받을 수 없는)/),
      match("LAW_FCLASS_CATEGORY_001", /(소방시설의 종류|해당되는 것은|해당되지 않는 것은|소화활동설비에 해당되는 것은|경보설비에 해당되지 않는 것은)/),
      fallback("LAW_FCLASS_EXTINGUISH_001")
    ]
  },
  FAC_ALARM_SYSTEM_001: {
    remove: "09_contents_facility_alarm.json",
    defs: [
      content("09_contents_facility_alarm.json", 69, "FAC_SYSTEM_DETECTOR_INSTALL_001", "소방전기시설의 구조 및 원리", "자동화재탐지설비", "감지기 일반 설치기준", "감지기 일반 설치기준을 정리한다.", "스포트형 감지기, 경사각, 부착 기준 등은 탐지설비 기본 설치 요소다.", "감지기를 어디에 어떻게 붙이는지 보는 파트다.", "감지기 일반 설치기준", "각도와 위치 기준이 자주 나온다.", "감지기 종류와 설치 기준을 섞으면 틀린다.", "설치형 기본 파트다.", "medium"),
      content("09_contents_facility_alarm.json", 70, "FAC_SYSTEM_CIRCUIT_ZONE_001", "소방전기시설의 구조 및 원리", "자동화재탐지설비", "배선·경계구역·도통시험", "배선과 경계구역 기준을 정리한다.", "전로저항, 배선 방식, 경계구역 구분은 탐지설비 회로 문제의 핵심이다.", "신호가 끊기지 않도록 나누는 기준을 보는 파트다.", "배선·경계구역 기준", "경계구역 면적과 층수 조건을 많이 묻는다.", "배선과 장치 기능을 분리하지 못하면 틀린다.", "회로형 기본 파트다.", "high"),
      content("09_contents_facility_alarm.json", 71, "FAC_SYSTEM_PANEL_CENTER_001", "소방전기시설의 구조 및 원리", "자동화재탐지설비", "수신기·방재센터 연동", "수신기와 종합방재센터 연동을 정리한다.", "수신기, 종합방재센터, 제어·표시·기록 기능은 운영 중심 출제 포인트다.", "화재신호가 어디서 모이고 어떻게 관리되는지 보는 파트다.", "수신기·방재센터 연동", "제어·표시·기록 기능을 비교해 묻는다.", "감지기와 수신기 역할을 바꾸면 틀린다.", "운영형 설비 파트다.", "medium"),
      content("09_contents_facility_alarm.json", 72, "FAC_SYSTEM_GAS_MISC_001", "소방전기시설의 구조 및 원리", "자동화재탐지설비", "가스누설·기타 복합설비", "가스누설경보기와 복합 제어문제를 정리한다.", "가스누설경보기, 이산화탄소 제어반, 복합 방재설비는 특수 운영문제로 자주 나온다.", "탐지설비와 다른 복합설비가 섞여 나오는 묶음이다.", "가스누설·복합설비", "절연저항, 제어반 기능을 자주 묻는다.", "탐지설비 일반 문제로 오해하면 틀린다.", "복합형 설비 파트다.", "medium")
    ],
    rules: [
      match("FAC_SYSTEM_GAS_MISC_001", /(가스누설경보기|이산화탄소 소화설비|제어반|절연저항|흡입식 탐지부)/),
      match("FAC_SYSTEM_PANEL_CENTER_001", /(종합방재센터|조작,표시,기록|수신기|방재설비의 동작)/),
      match("FAC_SYSTEM_CIRCUIT_ZONE_001", /(경계구역|전로저항|배선|도통시험|단선 여부|스포트형감지기의 배선)/),
      fallback("FAC_SYSTEM_DETECTOR_INSTALL_001")
    ]
  },
  FAC_ALARM_BROADCAST_001: {
    remove: "09_contents_facility_alarm.json",
    defs: [
      content("09_contents_facility_alarm.json", 73, "FAC_BROADCAST_SPEAKER_001", "소방전기시설의 구조 및 원리", "경보설비", "확성기 배치와 거리기준", "확성기 배치 기준을 정리한다.", "확성기 수평거리, 층별 배치는 비상방송설비의 대표 수치 기준이다.", "소리가 어디까지 들려야 하는지를 묻는 파트다.", "확성기 배치와 거리기준", "수평거리 문제가 반복된다.", "음향장치 기준과 섞으면 틀린다.", "배치형 기준 파트다.", "high"),
      content("09_contents_facility_alarm.json", 74, "FAC_BROADCAST_WIRING_001", "소방전기시설의 구조 및 원리", "경보설비", "비상방송 배선과 절연", "비상방송 배선 기준을 정리한다.", "배선 방식, 절연저항, 음량조정기 배선은 설비 안정성과 직접 연결된다.", "어떻게 연결해야 화재 때도 방송이 유지되는지를 보는 파트다.", "비상방송 배선과 절연", "절연저항과 배선 예외 조건이 자주 나온다.", "확성기 거리 기준과 혼동하면 틀린다.", "배선형 기준 파트다.", "medium"),
      content("09_contents_facility_alarm.json", 75, "FAC_BROADCAST_OPERATION_001", "소방전기시설의 구조 및 원리", "경보설비", "비상방송 기동과 우선경보", "기동과 우선경보 기준을 정리한다.", "방송 개시 시간, 우선경보 층, 기동장치 연동은 운용 핵심 기준이다.", "어느 층에 먼저 방송이 나가야 하는지를 보는 파트다.", "비상방송 기동과 우선경보", "우선경보 범위를 자주 묻는다.", "거리 기준만 보고 접근하면 운용형 문제를 놓친다.", "운용형 기준 파트다.", "high"),
      content("09_contents_facility_alarm.json", 76, "FAC_BROADCAST_AUDIO_001", "소방전기시설의 구조 및 원리", "경보설비", "음향장치와 스피커 특성", "음향장치 성능 기준을 정리한다.", "폰 값, 스피커 구조, 음성입력은 음향장치 성능 기준의 핵심이다.", "무조건 크게가 아니라 기준 이상이 되도록 설계하는 파트다.", "음향장치와 스피커 특성", "스피커 종류와 폰 기준이 함께 나온다.", "배선과 성능 기준을 섞으면 틀린다.", "성능형 기준 파트다.", "medium")
    ],
    rules: [
      match("FAC_BROADCAST_OPERATION_001", /(우선경보|개시될 때까지|기동장치|화재신고를 수신한 후)/),
      match("FAC_BROADCAST_WIRING_001", /(배선|절연저항|음량 조정기|수신기로부터 음향장치까지)/),
      match("FAC_BROADCAST_AUDIO_001", /(폰 이상|스피커|Speaker|음성 입력|가동코일|진동판)/),
      fallback("FAC_BROADCAST_SPEAKER_001")
    ]
  },
  FAC_ALARM_REPORT_001: {
    remove: "09_contents_facility_alarm.json",
    defs: [
      content("09_contents_facility_alarm.json", 77, "FAC_REPORT_AUTO_RULE_001", "소방전기시설의 구조 및 원리", "경보설비", "자동화재속보설비 설치기준", "자동화재속보설비 설치기준을 정리한다.", "속보설비 설치대상과 설치기준은 법규형·기준형 문제로 반복된다.", "어떤 건물에 속보설비가 필요한지를 보는 파트다.", "자동화재속보설비 설치기준", "대상물 기준을 자주 묻는다.", "기능 기준과 설치 기준을 섞으면 틀린다.", "설치형 속보 파트다.", "medium"),
      content("09_contents_facility_alarm.json", 78, "FAC_REPORT_AUTO_DEVICE_001", "소방전기시설의 구조 및 원리", "경보설비", "속보기 구조와 기능", "속보기 구조와 기능 기준을 정리한다.", "속보기의 구조, 다이얼링, 반복 호출, 외함 기준은 성능 문제의 핵심이다.", "장치가 실제로 어떻게 동작하는지를 보는 파트다.", "속보기 구조와 기능", "다이얼링 횟수와 외함 조건을 묻는다.", "설치 기준과 구조 기준을 섞으면 틀린다.", "성능형 속보 파트다.", "medium"),
      content("09_contents_facility_alarm.json", 79, "FAC_REPORT_AUTO_POWER_001", "소방전기시설의 구조 및 원리", "경보설비", "속보설비 예비전원", "속보설비 예비전원 기준을 정리한다.", "예비전원 유지시간과 충방전 조건은 속보설비 전원 문제의 핵심이다.", "정전 상황에서도 얼마나 버텨야 하는지를 보는 파트다.", "속보설비 예비전원", "분 단위 유지시간을 자주 묻는다.", "기능 기준만 기억하고 전원 기준을 놓치면 틀린다.", "전원형 속보 파트다.", "low"),
      content("09_contents_facility_alarm.json", 80, "FAC_REPORT_VISUAL_001", "소방전기시설의 구조 및 원리", "경보설비", "시각경보장치 기준", "시각경보장치 설치기준을 정리한다.", "청각장애인용 시각경보장치는 높이와 설치 장소 기준이 핵심이다.", "소리 대신 빛으로 경보를 주는 장치다.", "시각경보장치 기준", "설치 높이를 자주 묻는다.", "속보설비와 시각경보를 같은 장치처럼 보면 틀린다.", "시각 전달 파트다.", "low")
    ],
    rules: [
      match("FAC_REPORT_VISUAL_001", /(시각경보장치|청각장애인용)/),
      match("FAC_REPORT_AUTO_POWER_001", /(예비전원|충방전시험|유지하여야 하는가)/),
      match("FAC_REPORT_AUTO_DEVICE_001", /(속보기의 구조|다이얼링|외함|자동적으로 신호를 통보|기능 기준)/),
      fallback("FAC_REPORT_AUTO_RULE_001")
    ]
  },
  FAC_POWER_SOCKET_001: {
    remove: "10_contents_facility_evac_power.json",
    defs: [
      content("10_contents_facility_evac_power.json", 89, "FAC_SOCKET_COUNT_001", "소방전기시설의 구조 및 원리", "소화활동설비", "비상콘센트 개수와 회로수", "비상콘센트 개수와 회로수를 정리한다.", "전용회로 수와 하나의 회로에 연결되는 콘센트 수는 대표 출제 포인트다.", "한 회로에 몇 개까지 둘 수 있는지를 보는 파트다.", "비상콘센트 개수와 회로수", "층별 개수 기준을 반복 출제한다.", "설치 위치 문제와 섞으면 틀린다.", "수량형 기준 파트다.", "medium"),
      content("10_contents_facility_evac_power.json", 90, "FAC_SOCKET_LOCATION_001", "소방전기시설의 구조 및 원리", "소화활동설비", "비상콘센트 설치위치", "비상콘센트 설치위치를 정리한다.", "층별 배치, 거리, 설치 높이 등 위치 기준은 현장형 문제의 핵심이다.", "어디에 두어야 실제 사용이 가능한지를 보는 파트다.", "비상콘센트 설치위치", "배치 적합성 문제를 자주 묻는다.", "회로 수와 위치 기준을 섞으면 틀린다.", "배치형 기준 파트다.", "medium"),
      content("10_contents_facility_evac_power.json", 91, "FAC_SOCKET_BOX_001", "소방전기시설의 구조 및 원리", "소화활동설비", "보호함과 보호기준", "보호함과 보호기준을 정리한다.", "보호함의 구조와 보호 방식은 비상콘센트 안전기준의 핵심이다.", "사용성과 보호를 같이 만족시켜야 하는 장치다.", "보호함과 보호기준", "보호함 기준을 단독으로 묻는 문제가 나온다.", "콘센트 자체 기준과 보호함 기준을 섞으면 틀린다.", "보호구조 파트다.", "medium"),
      content("10_contents_facility_evac_power.json", 92, "FAC_SOCKET_POWER_001", "소방전기시설의 구조 및 원리", "소화활동설비", "비상콘센트 전원과 배선", "비상콘센트 전원과 배선을 정리한다.", "전압별 회로와 전원 공급 방식은 비상콘센트 설비의 전기적 핵심이다.", "콘센트가 실제로 살아 있게 하는 전원 구조를 보는 파트다.", "비상콘센트 전원과 배선", "전압별 회로 조건을 자주 묻는다.", "위치 문제만 익히면 전원형 문제에서 흔들린다.", "전원형 기준 파트다.", "medium")
    ],
    rules: [
      match("FAC_SOCKET_BOX_001", /(보호함)/),
      match("FAC_SOCKET_COUNT_001", /(몇 개 이하|전용회로|전압별로 몇 개 이상)/),
      match("FAC_SOCKET_POWER_001", /(전원회로|전압별로|전원)/),
      fallback("FAC_SOCKET_LOCATION_001")
    ]
  }
};

async function main() {
  const questionPath = path.join(learningDir, "11_questions_past_exam.json");
  const mapPath = path.join(learningDir, "12_content_question_map.json");
  const reportPath = path.join(learningDir, "validation_report.json");
  const memoryCardPath = path.join(learningDir, "30_memory_cards.json");
  const blankQuizPath = path.join(learningDir, "31_blank_quizzes.json");

  const questions = await readJson(questionPath);
  const mapItems = await readJson(mapPath);
  const contents = sortByLearningOrder(await loadContentFiles(learningDir));

  const removedIds = new Set(Object.keys(replacements));
  const replacementIds = new Set(
    Object.values(replacements).flatMap((item) => item.defs.map((def) => def.content_id))
  );
  const keptContents = contents.filter((item) => !removedIds.has(item.content_id) && !replacementIds.has(item.content_id));
  const addedContents = Object.values(replacements).flatMap((item) =>
    item.defs.map((def) => ({
      ...def,
      schema_version: SCHEMA_VERSION,
      review_cycle: REVIEW_CYCLE,
      status: "published"
    }))
  );
  const nextContents = sortByLearningOrder([...keptContents, ...addedContents]);
  const contentById = new Map(nextContents.map((item) => [item.content_id, item]));

  const nextMapItems = mapItems.map((item) => {
    const replacement = replacements[item.content_id];
    if (!replacement) {
      return item;
    }
    const question = questions.find((entry) => entry.question_id === item.question_id);
    const newContentId = chooseReplacement(replacement.rules, question);
    return { ...item, content_id: newContentId };
  });

  const orderByContentId = new Map();
  for (const item of nextMapItems.sort((a, b) => a.question_id.localeCompare(b.question_id))) {
    const nextOrder = (orderByContentId.get(item.content_id) || 0) + 1;
    orderByContentId.set(item.content_id, nextOrder);
    item.order_no = nextOrder;
  }

  const updatedQuestions = questions.map((question) => {
    const item = nextMapItems.find((entry) => entry.question_id === question.question_id);
    const content = item ? contentById.get(item.content_id) : null;
    if (!content) {
      return question;
    }
    return {
      ...question,
      chapter: content.chapter,
      topic: content.topic,
      exam_point: content.memory_point,
      tags: unique([question.subject, content.chapter, content.topic, ...(question.tags || [])])
    };
  });

  const groupedQuestionIds = new Map();
  for (const item of nextMapItems) {
    const current = groupedQuestionIds.get(item.content_id) || [];
    current.push(item.question_id);
    groupedQuestionIds.set(item.content_id, current);
  }

  const enrichedContents = nextContents.map((content) => enrich(content, groupedQuestionIds, updatedQuestions));

  await writeContentFiles(enrichedContents);
  await writeJson(mapPath, nextMapItems);
  await writeJson(questionPath, updatedQuestions);
  await writeJson(memoryCardPath, buildMemoryCards(enrichedContents));
  await writeJson(blankQuizPath, buildBlankQuizzes(enrichedContents));

  const report = await readJson(reportPath);
  report.content_count = enrichedContents.length;
  report.content_question_map_count = nextMapItems.length;
  report.memory_cards_count = enrichedContents.length;
  report.blank_quizzes_count = enrichedContents.length;
  await writeJson(reportPath, report);

  console.log(JSON.stringify(summarize(enrichedContents), null, 2));
}

function content(fileName, learningOrder, contentId, subject, chapter, topic, learningGoal, conceptCore, conceptEasy, memoryPoint, fieldNote, commonTrap, summary, examFrequency) {
  return {
    fileName,
    content_id: contentId,
    subject,
    chapter,
    topic,
    level: learningOrder < 40 ? "basic" : learningOrder < 70 ? "intermediate" : "basic",
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

function match(contentId, pattern) {
  return { contentId, pattern };
}

function fallback(contentId) {
  return { contentId, pattern: null };
}

function chooseReplacement(rules, question) {
  const haystack = `${question?.question_text || ""}\n${question?.explanation || ""}\n${question?.answer_text || ""}`;
  for (const rule of rules) {
    if (!rule.pattern) {
      return rule.contentId;
    }
    if (rule.pattern.test(haystack)) {
      return rule.contentId;
    }
  }
  return rules[rules.length - 1].contentId;
}

function enrich(content, groupedQuestionIds, questions) {
  const ids = unique(groupedQuestionIds.get(content.content_id) || []);
  const related = ids.map((id) => questions.find((item) => item.question_id === id)).filter(Boolean);
  const rates = related.map((item) => item.correct_rate).filter((value) => typeof value === "number");
  return {
    ...content,
    source_question_ids: ids,
    source_question_count: ids.length,
    correct_rate_avg: rates.length ? Number((rates.reduce((sum, value) => sum + value, 0) / rates.length).toFixed(1)) : null,
    needs_review_count: related.filter((item) => item.needs_review).length,
    exam_frequency: ids.length >= 35 ? "high" : ids.length >= 15 ? "medium" : "low"
  };
}

async function writeContentFiles(contents) {
  const byFile = new Map();
  for (const item of contents) {
    const fileName = fileNameFor(item.content_id);
    const current = byFile.get(fileName) || [];
    current.push(item);
    byFile.set(fileName, current);
  }
  for (const [fileName, items] of byFile) {
    await writeJson(path.join(learningDir, fileName), sortByLearningOrder(items));
  }
}

function fileNameFor(contentId) {
  if (contentId.startsWith("FIRE_BASIC_")) return "03_contents_fire_basic.json";
  if (contentId.startsWith("FIRE_EXT_")) return "04_contents_fire_extinguishing.json";
  if (contentId.startsWith("FIRE_")) return "05_contents_fire_hazard_evacuation.json";
  if (contentId.startsWith("EC_BASIC_") || contentId.startsWith("EC_MEASURE_") || contentId.startsWith("EC_MATERIAL_") || contentId.startsWith("EC_RULE_") || contentId.startsWith("EC_DC_") || contentId.startsWith("EC_AC_")) return "06_contents_electric_basic.json";
  if (contentId.startsWith("EC_CTRL_") || contentId.startsWith("EC_SEMI_")) return "07_contents_electric_control.json";
  if (contentId.startsWith("LAW_")) return "08_contents_law.json";
  if (contentId.startsWith("FAC_ALARM_") || contentId.startsWith("FAC_SYSTEM_") || contentId.startsWith("FAC_BROADCAST_") || contentId.startsWith("FAC_REPORT_")) return "09_contents_facility_alarm.json";
  return "10_contents_facility_evac_power.json";
}

function buildMemoryCards(contents) {
  return contents.map((content) => ({
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
}

function buildBlankQuizzes(contents) {
  return contents.map((content) => ({
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
}

function summarize(contents) {
  return {
    contentCount: contents.length,
    bySubject: Object.fromEntries(
      [...new Set(contents.map((item) => item.subject))].map((subject) => [
        subject,
        contents.filter((item) => item.subject === subject).length
      ])
    )
  };
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
