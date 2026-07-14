import { ensureReviewShape, scheduleReview } from "./reviewScheduler.js";
import { queueProgressSync } from "./cloudSync.js";

const STORAGE_KEY = "fireLearningApp.guestProgress";

function nowIso() {
  return new Date().toISOString();
}

function ensureProgressShape(progress) {
  progress.completedLessons ||= [];
  progress.memorizationStats ||= {};
  progress.solvedQuestions ||= {};
  progress.wrongAnswers ||= [];
  progress.bookmarks ||= [];
  progress.mockExamHistory ||= [];
  progress.lessonProgress ||= {};
  progress.subjectProgress ||= {};
  progress.dailyStudySession ||= null;
  progress.mockExamProgress ||= {
    completedExamIds: [],
    lastExamId: null,
    lastCompletedAt: null
  };
  progress.studyPlan ||= {
    durationDays: 30,
    selectedAt: progress.createdAt || nowIso(),
    startedAt: progress.createdAt || nowIso()
  };
  progress.studyPlan.startedAt ||= progress.studyPlan.selectedAt || progress.createdAt || nowIso();
  progress.currentDailyTarget ||= {
    durationDays: progress.studyPlan.durationDays === 60 ? 60 : 30,
    dayNo: 1,
    startedAt: progress.studyPlan.startedAt,
    completedAt: null
  };
  if (progress.currentDailyTarget.durationDays !== progress.studyPlan.durationDays) {
    progress.currentDailyTarget = {
      durationDays: progress.studyPlan.durationDays === 60 ? 60 : 30,
      dayNo: 1,
      startedAt: progress.studyPlan.startedAt,
      completedAt: null
    };
    progress.dailyStudySession = null;
  }
  if (
    progress.currentDailyTarget.previousDayNo
    && progress.currentDailyTarget.previousCompletedAt
    && !progress.currentDailyTarget.startedByUserAt
    && !progress.currentDailyTarget.routeId
    && !progress.currentDailyTarget.targetQuestionIds
  ) {
    progress.currentDailyTarget = {
      durationDays: progress.currentDailyTarget.durationDays,
      dayNo: progress.currentDailyTarget.previousDayNo,
      startedAt: progress.currentDailyTarget.startedAt,
      completedAt: progress.currentDailyTarget.previousCompletedAt
    };
    progress.dailyStudySession = null;
  }
  ensureReviewShape(progress);

  progress.wrongAnswers = progress.wrongAnswers.map((item) => ({
    sourceType: item.sourceType || "subject-quiz",
    sourceId: item.sourceId || item.subjectId || "legacy-subject",
    lessonId: item.lessonId || null,
    ...item
  }));

  return progress;
}

function ensureLessonProgressEntry(progress, lessonId) {
  progress.lessonProgress ||= {};
  progress.lessonProgress[lessonId] ||= {
    completedQuestionIds: []
  };
  progress.lessonProgress[lessonId].completedQuestionIds ||= [];
  return progress.lessonProgress[lessonId];
}

function createInitialProgress() {
  const timestamp = nowIso();
  return ensureProgressShape({
    guestId: "guest_local",
    createdAt: timestamp,
    lastAccessAt: timestamp,
    currentSubjectId: "fire_theory",
    completedLessons: [],
    memorizationStats: {},
    solvedQuestions: {},
    wrongAnswers: [],
    bookmarks: [],
    mockExamHistory: []
  });
}

export function getProgress() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const initial = createInitialProgress();
    saveProgress(initial);
    return initial;
  }

  try {
    return ensureProgressShape(JSON.parse(raw));
  } catch {
    const reset = createInitialProgress();
    saveProgress(reset);
    return reset;
  }
}

export function saveProgress(progress) {
  ensureProgressShape(progress);
  progress.lastAccessAt = nowIso();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  queueProgressSync(progress);
  return progress;
}

export function resetProgress() {
  const initial = createInitialProgress();
  saveProgress(initial);
  return initial;
}

export function markLessonCompleted(lessonId) {
  const progress = getProgress();
  if (!progress.completedLessons.includes(lessonId)) {
    progress.completedLessons.push(lessonId);
  }
  ensureLessonProgressEntry(progress, lessonId);
  return saveProgress(progress);
}

export function markLessonMemorizationPassed(lessonId) {
  const progress = getProgress();
  const lessonProgress = ensureLessonProgressEntry(progress, lessonId);
  lessonProgress.memorizationPassedAt = nowIso();
  return saveProgress(progress);
}

export function markLessonQuestionAnswered(lessonId, questionId) {
  const progress = getProgress();
  const lessonProgress = ensureLessonProgressEntry(progress, lessonId);
  if (!lessonProgress.completedQuestionIds.includes(questionId)) {
    lessonProgress.completedQuestionIds.push(questionId);
  }
  return saveProgress(progress);
}

export function markLessonQuizCompleted(lessonId) {
  const progress = getProgress();
  const lessonProgress = ensureLessonProgressEntry(progress, lessonId);
  lessonProgress.quizCompletedAt = nowIso();
  return saveProgress(progress);
}

export function saveDailyStudySession(session) {
  const progress = getProgress();
  progress.dailyStudySession = session;
  return saveProgress(progress);
}

export function clearDailyStudySession() {
  const progress = getProgress();
  progress.dailyStudySession = null;
  return saveProgress(progress);
}

export function saveCurrentDailyTarget(target) {
  const progress = getProgress();
  progress.currentDailyTarget = {
    ...(progress.currentDailyTarget || {}),
    ...target,
    updatedAt: nowIso()
  };
  return saveProgress(progress);
}

export function advanceCurrentDailyTarget(completedDayNo, durationDays) {
  const progress = getProgress();
  const planDays = durationDays === 60 ? 60 : 30;
  const current = progress.currentDailyTarget || {};

  if (Number(current.dayNo) !== Number(completedDayNo) || current.durationDays !== planDays) {
    return saveProgress(progress);
  }

  const timestamp = nowIso();
  progress.currentDailyTarget = {
    durationDays: planDays,
    dayNo: Math.min(Number(completedDayNo) + 1, planDays),
    startedAt: timestamp,
    completedAt: Number(completedDayNo) >= planDays ? timestamp : null,
    startedByUserAt: timestamp,
    previousDayNo: Number(completedDayNo),
    previousCompletedAt: timestamp
  };
  progress.dailyStudySession = null;
  return saveProgress(progress);
}

export function completeCurrentDailyTarget(dayNo, durationDays) {
  const progress = getProgress();
  const planDays = durationDays === 60 ? 60 : 30;
  const current = progress.currentDailyTarget || {};

  if (Number(current.dayNo) !== Number(dayNo) || current.durationDays !== planDays) {
    return saveProgress(progress);
  }

  progress.currentDailyTarget = {
    ...current,
    completedAt: current.completedAt || nowIso()
  };
  progress.dailyStudySession = null;
  return saveProgress(progress);
}

export function markSubjectWrongNoteCompleted(subjectId) {
  const progress = getProgress();
  progress.subjectProgress ||= {};
  progress.subjectProgress[subjectId] ||= {};
  progress.subjectProgress[subjectId].wrongNoteCompletedAt = nowIso();
  return saveProgress(progress);
}

function isSameWrongAnswerTarget(item, metadata) {
  return (
    item.questionId === metadata.questionId &&
    item.sourceType === metadata.sourceType &&
    item.sourceId === metadata.sourceId
  );
}

export function saveQuestionResult(questionId, selectedChoice, isCorrect, metadata) {
  const progress = getProgress();
  const {
    subjectId,
    sourceType = "subject-quiz",
    sourceId = subjectId,
    lessonId = null,
    reviewMode = null
  } = metadata;
  const previous = progress.solvedQuestions[questionId] || {
    questionId,
    attempts: 0,
    wrongCount: 0
  };

  progress.currentSubjectId = subjectId;
  progress.solvedQuestions[questionId] = {
    questionId,
    selectedChoice,
    isCorrect,
    attempts: previous.attempts + 1,
    wrongCount: isCorrect ? previous.wrongCount : previous.wrongCount + 1,
    lastSolvedAt: nowIso(),
    lastSourceType: sourceType,
    lastSourceId: sourceId,
    lessonId
  };

  if (!isCorrect) {
    addWrongAnswer(questionId, subjectId, progress, { sourceType, sourceId, lessonId });
  } else {
    const wrongEntry = progress.wrongAnswers.find((item) =>
      isSameWrongAnswerTarget(item, { questionId, sourceType, sourceId })
    );
    if (wrongEntry) {
      wrongEntry.reviewStatus = "cleared";
    }
  }

  scheduleReview(progress, {
    itemType: "question",
    itemId: questionId,
    subjectId,
    lessonId,
    sourceType,
    sourceId,
    isCorrect,
    reviewedAt: progress.solvedQuestions[questionId].lastSolvedAt,
    reviewMode
  });

  return saveProgress(progress);
}

export function addWrongAnswer(questionId, subjectId, baseProgress, metadata = {}) {
  const progress = baseProgress || getProgress();
  const sourceType = metadata.sourceType || "subject-quiz";
  const sourceId = metadata.sourceId || subjectId;
  const lessonId = metadata.lessonId || null;
  const existing = progress.wrongAnswers.find((item) =>
    isSameWrongAnswerTarget(item, { questionId, sourceType, sourceId })
  );

  if (existing) {
    existing.wrongCount += 1;
    existing.lastWrongAt = nowIso();
    existing.reviewStatus = "pending";
  } else {
    progress.wrongAnswers.push({
      questionId,
      subjectId,
      lessonId,
      sourceType,
      sourceId,
      wrongCount: 1,
      lastWrongAt: nowIso(),
      reviewStatus: "pending"
    });
  }

  if (!baseProgress) {
    return saveProgress(progress);
  }

  return progress;
}

export function toggleBookmark(questionId) {
  const progress = getProgress();
  if (progress.bookmarks.includes(questionId)) {
    progress.bookmarks = progress.bookmarks.filter((id) => id !== questionId);
  } else {
    progress.bookmarks.push(questionId);
  }
  return saveProgress(progress);
}

export function saveMockExamResult(result) {
  const progress = getProgress();
  progress.mockExamHistory.unshift(result);
  progress.mockExamProgress.completedExamIds ||= [];
  if (!progress.mockExamProgress.completedExamIds.includes(result.examId)) {
    progress.mockExamProgress.completedExamIds.unshift(result.examId);
  }
  progress.mockExamProgress.lastExamId = result.examId;
  progress.mockExamProgress.lastCompletedAt = nowIso();
  return saveProgress(progress);
}

export function setStudyPlan(durationDays) {
  const progress = getProgress();
  const timestamp = nowIso();
  const planDays = durationDays === 60 ? 60 : 30;
  progress.studyPlan = {
    durationDays: planDays,
    selectedAt: timestamp,
    startedAt: timestamp
  };
  progress.currentDailyTarget = {
    durationDays: planDays,
    dayNo: 1,
    startedAt: timestamp,
    completedAt: null
  };
  progress.dailyStudySession = null;
  return saveProgress(progress);
}

export function saveMemorizationStat(itemId, isCorrect, metadata = {}) {
  const progress = getProgress();
  const previous = progress.memorizationStats[itemId] || {
    attempts: 0,
    correctCount: 0,
    wrongCount: 0
  };

  progress.memorizationStats[itemId] = {
    attempts: previous.attempts + 1,
    correctCount: previous.correctCount + (isCorrect ? 1 : 0),
    wrongCount: previous.wrongCount + (isCorrect ? 0 : 1),
    lastAttemptAt: nowIso()
  };

  return saveProgress(progress);
}

export function resetMemorizationStats(itemIds = []) {
  const progress = getProgress();

  for (const itemId of itemIds) {
    delete progress.memorizationStats[itemId];
  }

  return saveProgress(progress);
}

export function getStorageKey() {
  return STORAGE_KEY;
}
