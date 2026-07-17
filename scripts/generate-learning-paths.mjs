import path from "node:path";
import {
  dataRoot,
  learningDir,
  readJson,
  sortByLearningOrder,
  unique,
  writeJson
} from "./data-pipeline-utils.mjs";

const SCHEMA_VERSION = "2.0-compatible-v1";
const OUTPUT_PATH = path.join(dataRoot, "02_learning_paths.json");

async function main() {
  const runtimeLessons = await readJson(path.join(dataRoot, "fire_lessons.json"));
  const contents = runtimeLessons.map((lesson, index) => ({
    ...lesson,
    content_id: lesson.id,
    subject: lesson.subjectId,
    topic: lesson.title,
    learning_order: index + 1
  }));
  const questions = await readJson(path.join(dataRoot, "fire_questions.json"));

  const questionById = new Map(questions.map((question) => [question.id, question]));
  const contentById = new Map(contents.map((content) => [content.content_id, content]));
  const questionIdsByContentId = new Map();
  const mappedQuestionIds = new Set();

  for (const content of contents) {
    for (const questionId of content.relatedQuestionIds || []) {
      if (!questionById.has(questionId) || !contentById.has(content.content_id)) {
      continue;
    }
      const current = questionIdsByContentId.get(content.content_id) || [];
      current.push(questionId);
      questionIdsByContentId.set(content.content_id, current);
      mappedQuestionIds.add(questionId);
    }
  }

  assignUnmappedQuestions({
    questions,
    contents,
    questionIdsByContentId,
    mappedQuestionIds
  });

  const updatedRuntimeLessons = runtimeLessons.map((lesson) => ({
    ...lesson,
    relatedQuestionIds: unique(questionIdsByContentId.get(lesson.id) || lesson.relatedQuestionIds || [])
  }));
  await writeJson(path.join(dataRoot, "fire_lessons.json"), updatedRuntimeLessons);

  const orderedBlocks = contents.map((content) => ({
    content,
    questionIds: unique(questionIdsByContentId.get(content.content_id) || [])
  }));

  const paths = [
    ...buildRoute({
      routeId: "beginner_30_days",
      routeName: "30일 개념+기출 완주 루트",
      routeType: "30_day",
      dayCount: 30,
      orderedBlocks,
      questionById
    }),
    ...buildRoute({
      routeId: "pass_60_days",
      routeName: "60일 합격 루트",
      routeType: "60_day",
      dayCount: 60,
      orderedBlocks,
      questionById
    })
  ];

  await writeJson(OUTPUT_PATH, paths);

  console.log(
    JSON.stringify(
      {
        pathCount: paths.length,
        routeSummaries: summarizeRoutes(paths, contentById)
      },
      null,
      2
    )
  );
}

function buildRoute({ routeId, routeName, routeType, dayCount, orderedBlocks, questionById }) {
  const lessonTargets = distributeCounts(orderedBlocks.length, dayCount);
  const days = lessonTargets.map((target, index) => ({
    schema_version: SCHEMA_VERSION,
    path_id: `${routeId}_day_${String(index + 1).padStart(2, "0")}`,
    route_id: routeId,
    route_type: routeType,
    route_name: routeName,
    day_no: index + 1,
    day_title: `${routeName} Day ${index + 1}`,
    learning_focus: "",
    subject_ids: [],
    content_ids: [],
    question_ids: [],
    estimated_minutes: 0,
    status: "published"
  }));

  let dayIndex = 0;
  let remainingCapacity = lessonTargets[0] || 0;

  for (const block of orderedBlocks) {
    while (remainingCapacity === 0 && dayIndex < days.length - 1) {
      dayIndex += 1;
      remainingCapacity = lessonTargets[dayIndex] || 0;
    }

    const day = days[dayIndex] || days[days.length - 1];
    pushUnique(day.content_ids, block.content.content_id);
    pushUnique(day.subject_ids, normalizeRouteSubject(block.content.subject));
    day.question_ids.push(...block.questionIds);
    remainingCapacity = Math.max(remainingCapacity - 1, 0);
  }

  for (const day of days) {
    day.question_ids = unique(day.question_ids);
    day.learning_focus = buildLearningFocus(day.content_ids, orderedBlocks);
    day.estimated_minutes = estimateMinutes(day.question_ids.length, day.content_ids.length);
  }

  return days;
}

function distributeCounts(total, buckets) {
  const base = Math.floor(total / buckets);
  const remainder = total % buckets;
  return Array.from({ length: buckets }, (_, index) => base + (index < remainder ? 1 : 0));
}

function buildLearningFocus(contentIds, orderedBlocks) {
  const topics = contentIds
    .map((contentId) => orderedBlocks.find((block) => block.content.content_id === contentId)?.content.topic)
    .filter(Boolean);
  if (topics.length === 0) {
    return "문제풀이 중심 학습";
  }
  if (topics.length === 1) {
    return `${topics[0]} 집중`;
  }
  return `${topics[0]} 외 ${topics.length - 1}개 주제`;
}

function estimateMinutes(questionCount, contentCount) {
  return contentCount * 12 + questionCount * 1.5;
}

function assignUnmappedContents(days, orderedBlocks) {
  const assigned = new Set(days.flatMap((day) => day.content_ids));
  const unmappedContents = orderedBlocks
    .filter((block) => !assigned.has(block.content.content_id))
    .map((block) => block.content.content_id);

  unmappedContents.forEach((contentId, index) => {
    const day = days[index % days.length];
    pushUnique(day.content_ids, contentId);
    const block = orderedBlocks.find((item) => item.content.content_id === contentId);
    if (block) {
      pushUnique(day.subject_ids, normalizeRouteSubject(block.content.subject));
    }
  });
}

function assignUnmappedQuestions({ questions, contents, questionIdsByContentId, mappedQuestionIds }) {
  const contentIdsBySubject = new Map();

  for (const content of contents) {
    const subjectId = content.subject;
    const current = contentIdsBySubject.get(subjectId) || [];
    current.push(content.content_id);
    contentIdsBySubject.set(subjectId, current);
  }

  const nextContentIndexBySubject = new Map();
  for (const question of questions) {
    if (mappedQuestionIds.has(question.id)) {
      continue;
    }

    const contentIds = contentIdsBySubject.get(question.subjectId) || [];
    if (contentIds.length === 0) {
      continue;
    }

    const nextIndex = nextContentIndexBySubject.get(question.subjectId) || 0;
    const contentId = contentIds[nextIndex % contentIds.length];
    const current = questionIdsByContentId.get(contentId) || [];
    current.push(question.id);
    questionIdsByContentId.set(contentId, current);
    nextContentIndexBySubject.set(question.subjectId, nextIndex + 1);
  }
}

function subjectIdForContent(contentId) {
  if (contentId.startsWith("FIRE_")) {
    return "fire_theory";
  }
  if (contentId.startsWith("EC_")) {
    return "electric_circuit";
  }
  if (contentId.startsWith("LAW_")) {
    return "fire_law";
  }
  if (contentId.startsWith("FAC_")) {
    return "fire_facility_electric";
  }
  return null;
}

function normalizeRouteSubject(subject) {
  switch (subject) {
    case "소방원론":
      return "fire_theory";
    case "소방전기회로":
      return "electric_circuit";
    case "소방관계법규":
      return "fire_law";
    case "소방전기시설의 구조 및 원리":
      return "fire_facility_electric";
    default:
      return subject;
  }
}

function pushUnique(items, value) {
  if (!items.includes(value)) {
    items.push(value);
  }
}

function summarizeRoutes(paths, contentById) {
  const routeIds = unique(paths.map((pathItem) => pathItem.route_id));
  return routeIds.map((routeId) => {
    const routeItems = paths.filter((pathItem) => pathItem.route_id === routeId);
    const questionIds = unique(routeItems.flatMap((item) => item.question_ids || []));
    const contentIds = unique(routeItems.flatMap((item) => item.content_ids || []));
    return {
      route_id: routeId,
      day_count: routeItems.length,
      question_count: questionIds.length,
      content_count: contentIds.length,
      first_day_title: routeItems[0]?.day_title || "",
      last_day_title: routeItems[routeItems.length - 1]?.day_title || "",
      sample_topics: contentIds.slice(0, 3).map((contentId) => contentById.get(contentId)?.topic).filter(Boolean)
    };
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
