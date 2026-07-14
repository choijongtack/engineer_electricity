import { getReviewQueueItems } from "./reviewScheduler.js";
import { isLessonFullyComplete, SUBJECT_QUIZ_SOURCE } from "./progression.js";

const DEFAULT_REVIEW_LIMIT = 20;
const MIX_TARGETS = {
  wrong: 0.5,
  frequent: 0.3,
  spaced: 0.2
};

function startOfDayTime(value = new Date()) {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    date.setTime(Date.now());
  }
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function wasSolvedToday(progress, questionId) {
  const solvedAt = progress.solvedQuestions?.[questionId]?.lastSolvedAt;
  return solvedAt ? new Date(solvedAt).getTime() >= startOfDayTime() : false;
}

function takeUnique(target, source, maxCount, seenIds) {
  for (const item of source) {
    if (target.length >= maxCount) {
      return;
    }
    if (seenIds.has(item.itemId)) {
      continue;
    }
    seenIds.add(item.itemId);
    target.push(item);
  }
}

function buildFrequentReviewItems(data, progress, { subjectId = null, sourceType = null } = {}) {
  if (sourceType) {
    return [];
  }

  const questionById = new Map(data.questions.map((question) => [question.id, question]));
  const solvedQuestionIds = new Set(Object.keys(progress.solvedQuestions || {}));

  return data.lessons
    .filter((lesson) => !subjectId || lesson.subjectId === subjectId)
    .filter((lesson) => isLessonFullyComplete(progress, lesson))
    .map((lesson) => ({
      lesson,
      questionIds: Array.isArray(lesson.relatedQuestionIds) ? lesson.relatedQuestionIds : []
    }))
    .filter((entry) => entry.questionIds.length >= 15)
    .sort((a, b) => b.questionIds.length - a.questionIds.length)
    .flatMap(({ lesson, questionIds }, lessonRank) =>
      questionIds
        .filter((questionId) => {
          const question = questionById.get(questionId);
          return question && !wasSolvedToday(progress, questionId);
        })
        .sort((a, b) => {
          const aSolved = solvedQuestionIds.has(a) ? 1 : 0;
          const bSolved = solvedQuestionIds.has(b) ? 1 : 0;
          return aSolved - bSolved;
        })
        .slice(0, 3)
        .map((questionId, index) => ({
          queueId: `frequent:${lesson.id}:${questionId}`,
          itemType: "question",
          itemId: questionId,
          subjectId: lesson.subjectId,
          lessonId: lesson.id,
          sourceType: SUBJECT_QUIZ_SOURCE,
          sourceId: lesson.subjectId,
          reason: "frequent",
          dueAt: new Date(startOfDayTime()).toISOString(),
          priority: 70 - lessonRank - index,
          status: "pending",
          lastResult: progress.solvedQuestions?.[questionId]?.isCorrect ? "correct" : null,
          scheduledAt: new Date().toISOString(),
          frequencyCount: questionIds.length
        }))
    );
}

export function buildMixedReviewItems(data, progress, options = {}) {
  const { limit = DEFAULT_REVIEW_LIMIT, subjectId = null, sourceType = null } = options;
  const dueItems = getReviewQueueItems(progress, {
    dueOnly: true,
    itemType: "question",
    subjectId,
    sourceType
  });
  const wrongItems = dueItems.filter((item) => item.reason === "wrong");
  const spacedItems = dueItems.filter((item) => item.reason !== "wrong");
  const frequentItems = buildFrequentReviewItems(data, progress, { subjectId, sourceType });
  const wrongLimit = Math.ceil(limit * MIX_TARGETS.wrong);
  const frequentLimit = Math.ceil(limit * MIX_TARGETS.frequent);
  const spacedLimit = Math.max(limit - wrongLimit - frequentLimit, 0);
  const seenIds = new Set();
  const mixed = [];

  takeUnique(mixed, wrongItems, wrongLimit, seenIds);
  takeUnique(mixed, frequentItems, wrongLimit + frequentLimit, seenIds);
  takeUnique(mixed, spacedItems, wrongLimit + frequentLimit + spacedLimit, seenIds);

  if (mixed.length < limit) {
    takeUnique(mixed, [...wrongItems, ...spacedItems, ...frequentItems], limit, seenIds);
  }

  return mixed.slice(0, limit);
}

export function getNextMixedReviewItem(data, progress, options = {}) {
  return buildMixedReviewItems(data, progress, { ...options, limit: 1 })[0] || null;
}
