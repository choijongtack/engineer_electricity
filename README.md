# 소방설비기사 전기분야 학습 앱 MVP

Firebase Auth, Firestore 사용자 진행도, Firebase Storage 콘텐츠를 사용하는 학습 앱입니다. Firebase 설정이 없으면 localStorage와 로컬 JSON으로 fallback합니다.

## 실행

정적 서버로 실행해야 `fetch` 기반 JSON 로딩이 동작합니다.

```bash
python -m http.server 8080
```

또는

```bash
npx serve .
```

## 현재 앱이 읽는 런타임 파일

- `data/fire_subjects.json`
- `data/fire_lessons.json`
- `data/fire_questions.json`
- `data/fire_mock-exam.json`

## 데이터 구조

```text
data/
  raw/cbtbank/
  learning/v2-compatible/
  fire_subjects.json
  fire_lessons.json
  fire_questions.json
  fire_mock-exam.json
```

## 데이터 파이프라인

### 1. 학습용 V2 JSON 생성

```bash
npm run data:build
```

- `data/raw/cbtbank/*.json` 에 선택된 원본 회차 복사
- `data/learning/v2-compatible/*.json` 생성

### 2. 무결성 검증

```bash
npm run data:validate
```

- `question_id`, `content_id` 중복 검증
- `content_question_map`, `learning_paths` 참조 무결성 검증

### 3. Supabase seed 생성

```bash
npm run data:seed
```

- `data/seed/supabase/*.seed.json` 생성

### 4. 현재 앱 런타임 JSON 갱신

```bash
npm run data:sync-app
```

- `data/learning/v2-compatible` 를 현재 앱용 `subjects/lessons/questions/mock-exam` 으로 변환

### 전체 실행

```bash
npm run data:all
```

## 레거시 명령

```bash
npm run sync:data
```

이 명령은 현재 `data/learning/v2-compatible` 내용을 앱 런타임 JSON으로 동기화합니다.

## 주요 모듈

- `src/app.js`: 앱 초기화와 흐름 제어
- `src/dataLoader.js`: JSON 로딩
- `src/storage.js`: `localStorage` 접근
- `src/quizEngine.js`: 기출문제 채점
- `src/memorizationEngine.js`: 암기 정답 판정
- `src/mockExamEngine.js`: 모의시험 상태와 채점
- `src/ui.js`: 화면 렌더링과 사용자 인터랙션
