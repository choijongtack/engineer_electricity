# App Flow Chart

이 문서는 `src/app.js`, `src/ui.js`, `src/router.js`, `src/storage.js` 기준으로 정리한 전체 앱 흐름도다.

## 추천 작성 방식

가장 추천하는 방식은 `Mermaid`를 원본으로 관리하는 것이다.

- 장점: 텍스트 기반이라 Git 추적이 쉽다.
- 장점: 화면 흐름이 바뀌면 코드처럼 수정 가능하다.
- 장점: Notion, GitHub, Markdown 문서로 재사용하기 쉽다.

## Notion 사용법

Notion도 괜찮다. 다만 작성 원본은 Notion 전용 도형 편집보다 `Mermaid` 코드가 더 유지보수에 유리하다.

권장 방식:

1. Notion 페이지에서 `/code` 블록을 만든다.
2. 언어를 `Mermaid`로 바꾼다.
3. 아래 Mermaid 코드를 붙여 넣는다.
4. 코드 블록의 보기 모드를 `Preview` 또는 `Split`으로 전환한다.

추천 워크플로우:

- 원본 관리: 이 파일의 Mermaid 코드
- 공유/정리: Notion 페이지
- 수정 기준: 코드 변경 후 Mermaid도 같이 갱신

## 전체 앱 흐름

```mermaid
flowchart TD
    A["앱 시작"] --> B["app.js init()"]
    B --> C{"hash route 있음?"}
    C -- "아니오" --> D["home으로 이동"]
    C -- "예" --> E["현재 route 유지"]
    D --> F["renderApp()"]
    E --> F

    F --> G["loadAllData() + getProgress()"]
    G --> H{"route 분기"}

    H --> H1["home"]
    H --> H2["concept"]
    H --> H3["memorization"]
    H --> H4["quiz"]
    H --> H5["wrong-note"]
    H --> H6["mock-exam"]
    H --> H7["progress"]
    H --> H8["settings"]

    H1 --> I["홈 대시보드 렌더"]
    I --> J{"사용자 액션"}
    J --> J1["현재 과목 학습 시작"]
    J --> J2["오늘 due 복습 시작"]
    J --> J3["탭 이동"]

    J1 --> K["concept 진입"]
    J2 --> L["reviewMode=true 후 quiz 진입"]
    J3 --> H

    H2 --> M["현재 과목/lesson 선택"]
    M --> N["개념 카드 표시"]
    N --> O{"lesson 완료 클릭?"}
    O -- "예" --> P["markLessonCompleted()"]
    P --> Q["해당 lesson 암기 세션 생성"]
    Q --> R["memorization 이동"]
    O -- "아니오" --> S["다른 lesson/과목 선택 또는 홈 이동"]

    H3 --> T["암기 문제 표시"]
    T --> U["submit-memorization"]
    U --> V["checkMemorizationAnswer()"]
    V --> W["saveMemorizationResult()"]
    W --> X{"advance-memorization"}

    X --> X1{"세션에 다음 암기 문항 있음?"}
    X1 -- "예" --> T
    X1 -- "아니오" --> X2{"전부 정답인가?"}

    X2 -- "아니오" --> M
    X2 -- "예" --> X3["markLessonMemorizationPassed()"]
    X3 --> X4{"연결 기출문제 있음?"}
    X4 -- "예" --> Y["lesson quiz session 시작"]
    X4 -- "아니오" --> Z["lesson 완료 처리"]

    H4 --> Y1["퀴즈/기출 화면 표시"]
    Y --> Y1
    L --> Y1
    Y1 --> Y2["submit-question"]
    Y2 --> Y3["submitAnswer()"]
    Y3 --> Y4{"quizSession mode"}

    Y4 -- "lesson-quiz" --> Y5["markLessonQuestionAnswered()"]
    Y5 --> Y6["advance-quiz"]
    Y6 --> Y7{"남은 lesson 문제 있음?"}
    Y7 -- "예" --> Y1
    Y7 -- "아니오" --> Z

    Y4 -- "review-queue" --> Y8["advance-quiz"]
    Y8 --> Y9{"다음 due 항목 있음?"}
    Y9 -- "예" --> Y1
    Y9 -- "아니오" --> I

    Y4 -- "wrong-note" --> YA["오답 재풀이 결과 반영"]
    YA --> YB{"해당 범위 pending 오답 남음?"}
    YB -- "예" --> H5
    YB -- "아니오" --> YC["과목 완료 또는 mock 오답 정리 완료"]
    YC --> Z

    Z["completeLessonQuizFlow()"] --> Z1["markLessonQuizCompleted()"]
    Z1 --> Z2{"같은 과목에 다음 lesson 있음?"}
    Z2 -- "예" --> M
    Z2 -- "아니오" --> Z3{"과목 오답노트 남음?"}
    Z3 -- "예" --> H5
    Z3 -- "아니오" --> Z4{"다음 과목 있음?"}
    Z4 -- "예" --> K
    Z4 -- "아니오" --> Z5{"mock exam 시작 가능?"}
    Z5 -- "예" --> H6
    Z5 -- "아니오" --> H7

    H5 --> WN1["오답노트 화면"]
    WN1 --> WN2["과목 오답 / 모의시험 오답 / due 복습 카드 표시"]
    WN2 --> WN3{"오답 다시 풀기 클릭?"}
    WN3 -- "예" --> Y1
    WN3 -- "아니오" --> WN4["필터 변경 또는 탭 이동"]

    H6 --> ME1{"mock exam 시작 여부"}
    ME1 -- "시작" --> ME2["startMockExam()"]
    ME2 --> ME3["시험 답안 선택"]
    ME3 --> ME4["submitMockExam()"]
    ME4 --> ME5["mockExamResult 저장"]
    ME5 --> ME6["wrong-note로 이동"]

    H7 --> PR1["전체 진도/정답률/due 수량 표시"]
    PR1 --> PR2["과목별 진행률 및 계획 확인"]

    H8 --> ST1["학습 플랜 선택"]
    H8 --> ST2["진도 초기화"]
    ST2 --> D
```

## 화면 중심 요약

```mermaid
flowchart LR
    Home["Home"] --> Concept["Concept"]
    Home --> Quiz["Quiz(due review)"]
    Concept --> Memorization["Memorization"]
    Memorization --> Concept
    Memorization --> Quiz
    Quiz --> WrongNote["Wrong Note"]
    Quiz --> Concept
    WrongNote --> Quiz
    WrongNote --> MockExam["Mock Exam"]
    MockExam --> WrongNote
    Home --> Progress["Progress"]
    Home --> Settings["Settings"]
```

## 핵심 규칙

- 새 lesson은 `개념 완료 -> 암기 100% 통과 -> lesson 기출 완료` 순서로 진행된다.
- 암기 세션은 전부 맞혀야 통과한다. 하나라도 틀리면 같은 lesson 개념 화면으로 돌아간다.
- due 복습은 `reviewMode`와 `reviewScheduler` 기준으로 퀴즈 화면에서 순차 진행된다.
- 과목 lesson이 끝나도 과목 오답이 남아 있으면 다음 과목으로 바로 넘어가지 않고 `wrong-note`를 먼저 처리한다.
- 모든 과목과 과목 오답 정리가 끝나면 `mock-exam` 진입 조건이 열린다.

