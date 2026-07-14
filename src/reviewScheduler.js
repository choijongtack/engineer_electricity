const DAY_MS = 24 * 60 * 60 * 1000;

const REVIEW_INTERVALS = {
  question: {
    correct: [1, 7],
    wrong: [0, 1, 3, 7]
  }
};

function normalizeDate(value) {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function startOfDayIso(value = new Date()) {
  const date = normalizeDate(value);
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

function addDays(baseDate, days) {
  return new Date(normalizeDate(baseDate).getTime() + days * DAY_MS).toISOString();
}

function buildReviewKey({ itemType, itemId, sourceType = "general", sourceId = "general" }) {
  return `${itemType}:${itemId}:${sourceType}:${sourceId}`;
}

function getIntervals(itemType, isCorrect) {
  const config = REVIEW_INTERVALS.question;
  return isCorrect ? config.correct : config.wrong;
}

function buildPriority(isCorrect, dueInDays) {
  if (!isCorrect) {
    return dueInDays === 0 ? 100 : 90;
  }
  return dueInDays <= 1 ? 50 : 30;
}

function upsertQueueItem(progress, entry) {
  const index = progress.reviewQueue.findIndex((item) => item.queueId === entry.queueId);
  if (index >= 0) {
    progress.reviewQueue[index] = {
      ...progress.reviewQueue[index],
      ...entry
    };
    return progress.reviewQueue[index];
  }

  progress.reviewQueue.push(entry);
  return entry;
}

export function ensureReviewShape(progress) {
  progress.reviewQueue ||= [];
  progress.itemReviewState ||= {};

  progress.reviewQueue = progress.reviewQueue
    .map((item) => ({
      queueId: item.queueId || buildReviewKey(item),
      itemType: item.itemType || "question",
      itemId: item.itemId || item.questionId,
      subjectId: item.subjectId || "unknown-subject",
      lessonId: item.lessonId || null,
      sourceType: item.sourceType || "general",
      sourceId: item.sourceId || item.subjectId || "general",
      reason: item.reason || "spaced",
      dueAt: item.dueAt || item.nextDueAt || null,
      priority: typeof item.priority === "number" ? item.priority : 30,
      status: item.status || "pending",
      lastResult: item.lastResult || null,
      scheduledAt: item.scheduledAt || item.updatedAt || null
    }))
    .filter((item) => item.itemType === "question");

  return progress;
}

export function scheduleReview(progress, metadata) {
  ensureReviewShape(progress);
  const {
    itemType,
    itemId,
    subjectId,
    lessonId = null,
    sourceType = "general",
    sourceId = "general",
    isCorrect,
    reviewedAt = new Date().toISOString(),
    reviewMode = null
  } = metadata;

  const queueId = buildReviewKey({ itemType, itemId, sourceType, sourceId });
  const state = progress.itemReviewState[queueId] || {
    itemType,
    itemId,
    subjectId,
    lessonId,
    sourceType,
    sourceId,
    streak: 0,
    lapseCount: 0,
    reviewStep: -1,
    lastResult: null,
    lastReviewedAt: null,
    lastReviewMode: null,
    nextDueAt: null,
    completedAt: null
  };

  const intervals = getIntervals(itemType, isCorrect);
  const previousStep = typeof state.reviewStep === "number" ? state.reviewStep : -1;

  if (isCorrect) {
    state.streak += 1;
    state.reviewStep = Math.min(previousStep + 1, intervals.length - 1);
  } else {
    state.streak = 0;
    state.lapseCount += 1;
    state.reviewStep = 0;
    state.completedAt = null;
  }

  state.itemType = itemType;
  state.itemId = itemId;
  state.subjectId = subjectId;
  state.lessonId = lessonId;
  state.sourceType = sourceType;
  state.sourceId = sourceId;
  state.lastResult = isCorrect ? "correct" : "wrong";
  state.lastReviewedAt = reviewedAt;
  state.lastReviewMode = reviewMode;

  const dueInDays = intervals[state.reviewStep] ?? null;

  if (isCorrect && previousStep >= intervals.length - 1) {
    state.nextDueAt = null;
    state.completedAt = reviewedAt;
    upsertQueueItem(progress, {
      queueId,
      itemType,
      itemId,
      subjectId,
      lessonId,
      sourceType,
      sourceId,
      reason: "completed",
      dueAt: null,
      priority: 0,
      status: "completed",
      lastResult: state.lastResult,
      scheduledAt: reviewedAt
    });
  } else {
    const dueAt = dueInDays === 0 ? startOfDayIso(reviewedAt) : addDays(reviewedAt, dueInDays);
    state.nextDueAt = dueAt;
    upsertQueueItem(progress, {
      queueId,
      itemType,
      itemId,
      subjectId,
      lessonId,
      sourceType,
      sourceId,
      reason: isCorrect ? "spaced" : "wrong",
      dueAt,
      priority: buildPriority(isCorrect, dueInDays),
      status: "pending",
      lastResult: state.lastResult,
      scheduledAt: reviewedAt
    });
  }

  progress.itemReviewState[queueId] = state;
  return state;
}

export function getReviewQueueItems(progress, filters = {}) {
  ensureReviewShape(progress);
  const {
    dueOnly = false,
    itemType = null,
    subjectId = null,
    sourceType = null
  } = filters;
  const today = startOfDayIso();

  return progress.reviewQueue
    .filter((item) => {
      if (item.status !== "pending") {
        return false;
      }
      if (itemType && item.itemType !== itemType) {
        return false;
      }
      if (subjectId && item.subjectId !== subjectId) {
        return false;
      }
      if (sourceType && item.sourceType !== sourceType) {
        return false;
      }
      if (dueOnly && (!item.dueAt || item.dueAt > today)) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      const dueCompare = String(a.dueAt || "").localeCompare(String(b.dueAt || ""));
      if (dueCompare !== 0) {
        return dueCompare;
      }
      return (b.priority || 0) - (a.priority || 0);
    });
}

export function getTodayDueReviewCount(progress, filters = {}) {
  return getReviewQueueItems(progress, { ...filters, dueOnly: true }).length;
}

export function getOverdueReviewCount(progress, filters = {}) {
  ensureReviewShape(progress);
  const today = startOfDayIso();
  return getReviewQueueItems(progress, filters).filter((item) => item.dueAt && item.dueAt < today).length;
}

export function getNextDueReviewItem(progress, filters = {}) {
  return getReviewQueueItems(progress, { ...filters, dueOnly: true })[0] || null;
}

export function getReviewSummary(progress) {
  const dueItems = getReviewQueueItems(progress, { dueOnly: true, itemType: "question" });
  return {
    totalDueCount: dueItems.length,
    dueQuestionCount: dueItems.filter((item) => item.itemType === "question").length,
    overdueCount: getOverdueReviewCount(progress)
  };
}
