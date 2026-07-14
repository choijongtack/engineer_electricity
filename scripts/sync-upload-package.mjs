import path from "node:path";
import {
  appDataDir,
  fileExists,
  learningDir,
  loadContentFiles,
  normalizeSubjectId,
  readJson,
  subjectDescriptions,
  unique,
  writeJson
} from "./data-pipeline-utils.mjs";

async function main() {
  const sourceDir = process.argv[2] ? path.resolve(process.argv[2]) : learningDir;
  const schema = await readJson(path.join(sourceDir, "01_schema_meta.json"));
  const learningPaths = await readJson(path.join(sourceDir, "02_learning_paths.json"));
  const questions = await readJson(path.join(sourceDir, "11_questions_past_exam.json"));
  const mapItems = (await fileExists(path.join(sourceDir, "12_content_question_map.json")))
    ? await readJson(path.join(sourceDir, "12_content_question_map.json"))
    : [];
  const memoryCards = (await fileExists(path.join(sourceDir, "30_memory_cards.json")))
    ? await readJson(path.join(sourceDir, "30_memory_cards.json"))
    : [];
  const blankQuizzes = (await fileExists(path.join(sourceDir, "31_blank_quizzes.json")))
    ? await readJson(path.join(sourceDir, "31_blank_quizzes.json"))
    : [];
  const examSets = (await fileExists(path.join(sourceDir, "32_exam_sets.json")))
    ? await readJson(path.join(sourceDir, "32_exam_sets.json"))
    : [];
  const contents = await loadContentFiles(sourceDir);

  const subjects = buildSubjects(schema);
  const lessons = buildLessons(contents, mapItems, memoryCards, blankQuizzes);
  const appQuestions = buildAppQuestions(questions);
  const mockExam = buildMockExam(examSets, learningPaths, new Set(appQuestions.map((question) => question.id)));

  await writeJson(path.join(appDataDir, "fire_subjects.json"), subjects);
  await writeJson(path.join(appDataDir, "fire_lessons.json"), lessons);
  await writeJson(path.join(appDataDir, "fire_questions.json"), appQuestions);
  await writeJson(path.join(appDataDir, "fire_mock-exam.json"), mockExam);

  console.log(
    JSON.stringify(
      {
        sourceDir,
        subjects: subjects.length,
        lessons: lessons.length,
        questions: appQuestions.length,
        mockExamQuestions: mockExam.questionIds.length
      },
      null,
      2
    )
  );
}

function buildSubjects(schema) {
  return (schema.subjects || []).map((subject, index) => {
    const id = normalizeSubjectId(subject.name || subject.code);
    if (!id) {
      throw new Error(`Unsupported subject mapping: ${subject.name || subject.code}`);
    }

    return {
      id,
      name: subject.name,
      order: index + 1,
      description: subjectDescriptions[id] || subject.name
    };
  });
}

function buildLessons(contents, mapItems, memoryCards, blankQuizzes) {
  const relatedQuestionIdsByContentId = new Map();
  const memoryCardByContentId = new Map(memoryCards.map((card) => [card.content_id, card]));
  const blankQuizByContentId = new Map(blankQuizzes.map((quiz) => [quiz.content_id, quiz]));

  for (const item of mapItems) {
    const current = relatedQuestionIdsByContentId.get(item.content_id) || [];
    current.push(item.question_id);
    relatedQuestionIdsByContentId.set(item.content_id, current);
  }

  return contents
    .filter((content) => content.status === "published")
    .map((content) => {
      const subjectId = normalizeSubjectId(content.subject);
      if (!subjectId) {
        throw new Error(`Unsupported lesson subject mapping: ${content.subject}`);
      }

      const memoryCard = memoryCardByContentId.get(content.content_id) || null;
      const blankQuiz = blankQuizByContentId.get(content.content_id) || null;

      return {
        id: content.content_id,
        subjectId,
        chapterId: content.chapter,
        title: content.title,
        level: content.level,
        summary: content.summary,
        conceptCards: buildConceptCards(content, memoryCard),
        memorizationItems: buildMemorizationItems(content, memoryCard, blankQuiz),
        relatedQuestionIds: unique(relatedQuestionIdsByContentId.get(content.content_id) || [])
      };
    });
}

function buildConceptCards(content, memoryCard) {
  const cards = [
    {
      id: `CARD-${content.content_id}-CORE`,
      title: content.topic || content.title,
      body: content.concept_core,
      keywords: unique([content.subject, content.chapter, content.level])
    },
    {
      id: `CARD-${content.content_id}-EASY`,
      title: "쉽게 이해",
      body: content.concept_easy,
      keywords: unique([content.memory_point, ...(content.tags || [])])
    },
    {
      id: `CARD-${content.content_id}-POINT`,
      title: "시험 포인트",
      body: `${content.memory_point} / 함정: ${content.common_trap}`,
      keywords: unique([content.field_note, content.summary])
    }
  ];

  if (memoryCard) {
    cards.push({
      id: memoryCard.memory_card_id,
      title: memoryCard.front,
      body: memoryCard.back,
      keywords: unique([memoryCard.subject, memoryCard.chapter, memoryCard.topic])
    });
  }

  return cards;
}

function buildMemorizationItems(content, memoryCard, blankQuiz) {
  const items = [];

  items.push({
    id: `MEM-${content.content_id}-TOPIC`,
    type: "short-answer",
    prompt: `${content.concept_core} / 이 설명에 해당하는 주제를 입력하세요.`,
    answer: content.topic || content.title,
    acceptableAnswers: unique([content.topic, content.title]),
    hint: content.memory_point,
    answerLabel: "주제"
  });

  if (memoryCard) {
    items.push({
      id: memoryCard.memory_card_id,
      type: "short-answer",
      prompt: memoryCard.front,
      answer: memoryCard.back,
      acceptableAnswers: [memoryCard.back],
      hint: content.summary,
      answerLabel: "암기 답안"
    });
  }

  if (blankQuiz) {
    items.push({
      id: blankQuiz.blank_quiz_id,
      type: "short-answer",
      prompt: blankQuiz.prompt,
      answer: blankQuiz.answer,
      acceptableAnswers: [blankQuiz.answer],
      hint: blankQuiz.hint || content.summary,
      answerLabel: "빈칸 답안"
    });
  }

  items.push({
    id: `MEM-${content.content_id}-OX`,
    type: "ox",
    prompt: `${content.common_trap} / 이 문장을 그대로 외우면 맞다.`,
    answer: "X",
    acceptableAnswers: ["X", "x"],
    hint: content.memory_point,
    answerLabel: "O 또는 X"
  });

  return items;
}

function buildAppQuestions(questions) {
  return questions.map((question) => {
    const subjectId = normalizeSubjectId(question.subject);
    if (!subjectId) {
      throw new Error(`Unsupported question subject mapping: ${question.subject}`);
    }

    return {
      id: question.question_id,
      source: {
        examDate: question.source_date,
        examName: `${question.subject} 기출문제`,
        questionNumber: question.source_question_no
      },
      subjectId,
      chapterId: question.chapter,
      type: question.question_type,
      difficulty: inferDifficulty(question.correct_rate),
      question: question.question_text,
      choices: (question.choices || []).map((choice) => ({
        number: choice.choice_no,
        text: choice.choice_text
      })),
      answer: question.answer,
      explanation: question.explanation,
      tags: unique([question.chapter, question.topic, question.exam_point, ...(question.tags || [])])
    };
  });
}

function inferDifficulty(correctRate) {
  if (typeof correctRate !== "number") {
    return "basic";
  }
  if (correctRate >= 80) {
    return "easy";
  }
  if (correctRate >= 60) {
    return "basic";
  }
  if (correctRate >= 40) {
    return "intermediate";
  }
  return "advanced";
}

function buildMockExam(examSets, learningPaths, questionIds) {
  const preferredExamSet = (examSets || []).find((item) => (item.question_ids || []).length > 0) || null;
  if (preferredExamSet) {
    const selectedQuestionIds = unique((preferredExamSet.question_ids || []).filter((questionId) => questionIds.has(questionId)));
    return {
      id: String(preferredExamSet.exam_set_id || "mock_set_01").toLowerCase(),
      title: preferredExamSet.title || "모의고사 1회",
      durationMinutes: preferredExamSet.duration_minutes || 80,
      questionIds: selectedQuestionIds.length ? selectedQuestionIds : [...questionIds].slice(0, 80)
    };
  }

  const preferredPath =
    learningPaths.find((item) => item.day_no === 30) ||
    learningPaths.find((item) => (item.question_ids || []).length > 0) ||
    null;

  const selectedQuestionIds = unique((preferredPath?.question_ids || []).filter((questionId) => questionIds.has(questionId)));

  return {
    id: String(preferredPath?.path_id || "beginner_30_days").toLowerCase(),
    title: preferredPath?.day_title || "미니 모의고사",
    durationMinutes: preferredPath?.estimated_minutes || 35,
    questionIds: selectedQuestionIds.length ? selectedQuestionIds : [...questionIds].slice(0, 20)
  };
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
