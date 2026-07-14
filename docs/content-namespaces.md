# Content Data Operations

Static learning content is bundled with the app and loaded from local JSON files:

```text
data/fire_subjects.json
data/fire_lessons.json
data/fire_questions.json
data/fire_mock-exam.json
data/learning/v2-compatible/02_learning_paths.json
```

Firebase is used for authentication and per-user progress data in Firestore. Static content is not loaded from Firebase Storage, so content changes are released together with the app and cannot be affected by stale remote files.

The `sample`, `merged`, and `cbtbank` files are intermediate or validation artifacts used by the data pipeline. They are not runtime data sources.
