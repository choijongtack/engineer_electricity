# 앱 학습 JSON 생성 절차

앱에서 직접 읽는 최종 산출물은 다음 5개다.

- `data/02_learning_paths.json`: 30일/60일 학습 경로
- `data/fire_subjects.json`: 과목 목록
- `data/fire_lessons.json`: 개념 레슨, 암기 항목, 관련 기출 ID
- `data/fire_questions.json`: 앱에서 사용하는 기출문제
- `data/fire_mock-exam.json`: 앱용 모의시험 세트

## 전체 실행

프로젝트 루트에서 다음 명령 하나로 재생성한다.

```bash
npm run data:rebuild-app
```

이 명령은 `scripts/rebuild-app-data.mjs`가 기존 생성기를 아래 순서로 실행한다.

1. `data/raw/cbtbank/*.json`을 읽어 `data/fire_questions.json`을 만든다.
2. 학습 원본(`data/learning/v2-compatible` 또는 기존 설정 경로)을 이용해 학습 패키지를 만들고 검증 보고서를 갱신한다.
3. 최근 기출 회차를 모의고사 10세트로 만들어 `32_exam_sets.json`으로 저장한다. 최소 10개 기출 회차가 없으면 중단한다.
4. 앱 레슨과 기출문제를 기준으로 `data/02_learning_paths.json`의 30일/60일 경로를 만든다.
5. 학습 패키지를 앱 런타임 형식으로 변환해 `fire_subjects.json`, `fire_lessons.json`, `fire_questions.json`, `fire_mock-exam.json`을 저장한다.

## 개별 실행기

필요할 때는 다음 생성기를 개별 실행할 수 있다.

```bash
npm run data:generate-fire-questions
node scripts/build-learning-json.mjs
node scripts/generate-exam-sets.mjs
node scripts/generate-learning-paths.mjs
npm run data:sync-app
```

`fire_questions.json`의 원천은 `data/raw/cbtbank`이며, 레슨과 학습 경로의 원천은 `data/learning/v2-compatible`의 콘텐츠·매핑·암기 카드·빈칸 퀴즈다. 앱 동기화 단계에서는 이 학습 패키지를 앱이 사용하는 간결한 런타임 스키마로 변환한다.

초기화 명령(`npm run data:init-clean`)도 외부 CBT 프로젝트를 참조하지 않는다. 기본 입력은 이 저장소의 `data/raw/cbtbank/fire_electric_YYYYMMDD.json`이며, `data/raw/index.json`이 있으면 그 인덱스를 사용하고 없으면 파일명에서 회차 목록을 자동으로 만든다.

## 주의

- 원본 기출 파일이나 학습 패키지를 바꾼 뒤 실행한다.
- 실행 전후 `npm run data:validate`로 참조 무결성을 확인한다.
- `data/02_learning_paths.json`은 앱 런타임 JSON과 별도로 생성되며, 경로의 `question_ids`가 `fire_questions.json`의 ID를 참조한다.
