# AGENTS.md

## 프로젝트 규칙

- 이 프로젝트는 초기 MVP이므로 서버 DB를 붙이지 않는다.
- 로그인 기능은 아직 구현하지 않는다.
- 모든 학습 기록은 브라우저 `localStorage`에 저장한다.
- 콘텐츠는 `/data/*.json`에서 로드한다.
- 기능 추가 시 JSON 구조와 `storage.js` 저장 구조를 깨지 않는다.
- UI는 단순하되 학습 흐름이 명확해야 한다.
- 개념학습, 빈칸 암기, 기출문제, 오답노트, 모의시험, 학습현황, 설정 화면을 유지한다.
- 주요 기능 변경 시 `tests/manual-test-checklist.md`도 함께 갱신한다.

## 구현 원칙

- `app.js`는 초기화와 흐름 제어에 집중한다.
- `dataLoader.js`에서만 JSON 로딩을 처리한다.
- `storage.js`에서만 localStorage 접근을 처리한다.
- `quizEngine.js`는 기출문제 채점 로직을 담당한다.
- `memorizationEngine.js`는 빈칸 암기검사 로직을 담당한다.
- `mockExamEngine.js`는 모의시험 상태와 채점 로직을 담당한다.
- `ui.js`는 화면 렌더링과 사용자 인터랙션을 담당한다.
