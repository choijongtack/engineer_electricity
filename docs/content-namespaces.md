# 콘텐츠 네임스페이스

현재 앱의 런타임 콘텐츠는 Firebase Storage의 `fire/` 폴더 아래에서 `fire_` 접두어를 사용합니다.

```text
fire/fire_subjects.json
fire/fire_lessons.json
fire/fire_questions.json
fire/fire_mock-exam.json
```

추후 시험을 추가할 때는 같은 구조로 시험 식별자를 앞에 붙입니다.

```text
data/electrical_subjects.json
data/electrical_lessons.json
data/electrical_questions.json
data/electrical_mock-exam.json
```

`sample`, `merged`, `cbtbank` 파일은 데이터 생성 파이프라인의 중간·검증 산출물이므로 이번 변경에서는 이름을 유지합니다. Firebase Storage로 업로드할 대상은 네임스페이스가 붙은 런타임 파일을 기준으로 합니다.
