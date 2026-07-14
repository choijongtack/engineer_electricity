export const SUBJECT_QUIZ_SOURCE = "subject-quiz";
export const MOCK_EXAM_SOURCE = "mock-exam";

import { getReviewQueueItems, getReviewSummary } from "./reviewScheduler.js";

export function getOrderedSubjects(data) {
  return [...data.subjects].sort((a, b) => (a.order || 0) - (b.order || 0));
}

export function getLessonsBySubject(data, subjectId) {
  return data.lessons.filter((lesson) => lesson.subjectId === subjectId);
}

export function getRelatedQuestionIds(lesson) {
  return Array.isArray(lesson?.relatedQuestionIds) ? lesson.relatedQuestionIds : [];
}

export function isLessonConceptComplete(progress, lessonId) {
  return progress.completedLessons.includes(lessonId);
}

export function isLessonMemorizationPassed(progress, lessonId) {
  return Boolean(progress.lessonProgress?.[lessonId]?.memorizationPassedAt);
}

export function isLessonQuizCompleted(progress, lesson) {
  const relatedQuestionIds = getRelatedQuestionIds(lesson);
  if (!relatedQuestionIds.length) {
    return true;
  }

  return Boolean(progress.lessonProgress?.[lesson.id]?.quizCompletedAt);
}

export function isLessonFullyComplete(progress, lesson) {
  return (
    isLessonConceptComplete(progress, lesson.id) &&
    isLessonMemorizationPassed(progress, lesson.id) &&
    isLessonQuizCompleted(progress, lesson)
  );
}

export function getPendingLessonQuestionIds(progress, lesson) {
  const relatedQuestionIds = getRelatedQuestionIds(lesson);
  const completedQuestionIds = new Set(progress.lessonProgress?.[lesson.id]?.completedQuestionIds || []);
  return relatedQuestionIds.filter((questionId) => !completedQuestionIds.has(questionId));
}

export function getPendingWrongAnswers(progress, { subjectId = null, sourceType = null } = {}) {
  return progress.wrongAnswers.filter((item) => {
    if (item.reviewStatus !== "pending") {
      return false;
    }
    if (subjectId && item.subjectId !== subjectId) {
      return false;
    }
    if (sourceType && item.sourceType !== sourceType) {
      return false;
    }
    return true;
  });
}

export function hasPendingSubjectWrongAnswers(progress, subjectId) {
  return getPendingWrongAnswers(progress, { subjectId, sourceType: SUBJECT_QUIZ_SOURCE }).length > 0;
}

export function hasPendingMockExamWrongAnswers(progress) {
  return getPendingWrongAnswers(progress, { sourceType: MOCK_EXAM_SOURCE }).length > 0;
}

export function getDueQuestionReviewItems(progress, filters = {}) {
  return getReviewQueueItems(progress, { ...filters, dueOnly: true, itemType: "question" });
}

export function buildReviewCounts(progress) {
  return getReviewSummary(progress);
}

export function isSubjectFullyComplete(data, progress, subjectId) {
  const lessons = getLessonsBySubject(data, subjectId);
  if (!lessons.length) {
    return true;
  }

  const lessonsComplete = lessons.every((lesson) => isLessonFullyComplete(progress, lesson));
  return lessonsComplete && !hasPendingSubjectWrongAnswers(progress, subjectId);
}

export function getCurrentSubject(data, progress) {
  const orderedSubjects = getOrderedSubjects(data);
  return orderedSubjects.find((subject) => !isSubjectFullyComplete(data, progress, subject.id)) || orderedSubjects[0] || null;
}

export function getNextSubject(data, subjectId) {
  const orderedSubjects = getOrderedSubjects(data);
  const subjectIndex = orderedSubjects.findIndex((subject) => subject.id === subjectId);
  return subjectIndex >= 0 ? orderedSubjects[subjectIndex + 1] || null : null;
}

export function getUnlockedSubjectIds(data, progress) {
  const orderedSubjects = getOrderedSubjects(data);
  const currentSubject = getCurrentSubject(data, progress);
  if (!currentSubject) {
    return orderedSubjects.map((subject) => subject.id);
  }

  const currentIndex = orderedSubjects.findIndex((subject) => subject.id === currentSubject.id);
  return orderedSubjects.slice(0, currentIndex + 1).map((subject) => subject.id);
}

export function canStartMockExam(data, progress) {
  return getOrderedSubjects(data).every((subject) => isSubjectFullyComplete(data, progress, subject.id));
}
