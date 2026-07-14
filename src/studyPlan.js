import { isLessonFullyComplete } from "./progression.js";
import { getReviewQueueItems, getReviewSummary } from "./reviewScheduler.js";

const DAY_MS = 24 * 60 * 60 * 1000;

const STUDY_PLAN_CONFIG = {
  30: {
    label: "30일 집중 플랜",
    routeType: "30_day",
    wrongNoteRule: "당일 오답 확인, 2일 단위로 누적 오답 재점검",
    mockExamRule: "전 범위 완료 후 3일 간격으로 모의고사 진행"
  },
  60: {
    label: "60일 분산 플랜",
    routeType: "60_day",
    wrongNoteRule: "당일 오답 확인, 3~4일 간격으로 누적 오답 재점검",
    mockExamRule: "전 범위 완료 후 매주 1회 모의고사 진행"
  }
};

function clampPlanDays(value) {
  return value === 60 ? 60 : 30;
}

function normalizeDate(value) {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function getCurrentDayNo(progress, durationDays) {
  const activeTarget = progress.currentDailyTarget;
  if (
    activeTarget
    && activeTarget.durationDays === durationDays
    && Number(activeTarget.dayNo) >= 1
  ) {
    return Math.min(Number(activeTarget.dayNo), durationDays);
  }

  const startedAt = progress.studyPlan?.startedAt || progress.studyPlan?.selectedAt || progress.createdAt;
  const elapsedDays = Math.floor((Date.now() - normalizeDate(startedAt).getTime()) / DAY_MS);
  return Math.min(Math.max(elapsedDays + 1, 1), durationDays);
}

function unique(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function getDailyPath(learningPaths, plan, dayNo) {
  const paths = Array.isArray(learningPaths) ? learningPaths : [];
  return (
    paths.find((item) => item.route_type === plan.routeType && Number(item.day_no) === dayNo) ||
    paths.find((item) => item.route_id?.includes(String(plan.durationDays)) && Number(item.day_no) === dayNo) ||
    null
  );
}

function getPlanPaths(learningPaths, plan) {
  const paths = Array.isArray(learningPaths) ? learningPaths : [];
  return paths.filter((item) =>
    item.route_type === plan.routeType ||
    item.route_id?.includes(String(plan.durationDays))
  );
}

function isReviewedAfter(value, baseValue) {
  if (!value || !baseValue) {
    return false;
  }

  return normalizeDate(value).getTime() >= normalizeDate(baseValue).getTime();
}

function countCompletedTargetReviews(progress, queueIds, startedAt) {
  return queueIds.filter((queueId) => {
    const state = progress.itemReviewState?.[queueId];
    if (isReviewedAfter(state?.lastReviewedAt, startedAt)) {
      return true;
    }

    const item = progress.reviewQueue?.find((entry) => entry.queueId === queueId);
    return item?.status === "completed";
  }).length;
}

function buildScheduleProgress(data, progress, plan) {
  const planPaths = getPlanPaths(data.learningPaths, plan);
  const plannedLessonIds = unique(planPaths.flatMap((path) => path.content_ids || []));
  const plannedQuestionIds = unique(planPaths.flatMap((path) => path.question_ids || []));
  const solvedQuestionIds = new Set(Object.keys(progress.solvedQuestions || {}));
  const completedLessonCount = plannedLessonIds.filter((lessonId) => {
    const lesson = data.lessons.find((entry) => entry.id === lessonId);
    return lesson ? isLessonFullyComplete(progress, lesson) : false;
  }).length;
  const completedQuestionCount = plannedQuestionIds.filter((questionId) => solvedQuestionIds.has(questionId)).length;
  const totalCount = plannedLessonIds.length + plannedQuestionIds.length;
  const completedCount = completedLessonCount + completedQuestionCount;

  return {
    totalCount,
    completedCount,
    percent: totalCount ? Math.min(100, Math.round((completedCount / totalCount) * 100)) : 0,
    plannedLessonCount: plannedLessonIds.length,
    plannedQuestionCount: plannedQuestionIds.length,
    completedLessonCount,
    completedQuestionCount
  };
}

function buildFallbackTarget(data, progress, plan, reviewSummary) {
  const totalQuestions = data.questions.length;
  const dailyQuestions = Math.max(1, Math.ceil(totalQuestions / plan.durationDays));
  const solvedQuestionIds = new Set(Object.keys(progress.solvedQuestions || {}));
  const questionIds = data.questions
    .filter((question) => !solvedQuestionIds.has(question.id))
    .slice(0, dailyQuestions)
    .map((question) => question.id);

  return {
    source: "fallback",
    dayNo: getCurrentDayNo(progress, plan.durationDays),
    title: `${plan.label} 오늘 학습`,
    focus: "전체 기출 기준 자동 배분",
    subjectIds: [],
    contentIds: [],
    questionIds,
    lessonCount: 0,
    questionCount: questionIds.length,
    completedLessonCount: 0,
    completedQuestionCount: 0,
    remainingLessonCount: 0,
    remainingQuestionCount: questionIds.length,
    dueReviewCount: reviewSummary.totalDueCount,
    dueQuestionCount: reviewSummary.dueQuestionCount,
    overdueReviewCount: reviewSummary.overdueCount,
    totalTodayCount: questionIds.length + reviewSummary.totalDueCount,
    completedTodayCount: 0,
    remainingTodayCount: questionIds.length + reviewSummary.totalDueCount
  };
}

export function getStudyPlanOptions() {
  return [30, 60].map((days) => ({
    durationDays: days,
    ...STUDY_PLAN_CONFIG[days]
  }));
}

export function getStudyPlan(progress) {
  const durationDays = clampPlanDays(progress.studyPlan?.durationDays);
  return {
    durationDays,
    ...STUDY_PLAN_CONFIG[durationDays]
  };
}

export function buildDailyStudyTarget(data, progress) {
  const plan = getStudyPlan(progress);
  const reviewSummary = getReviewSummary(progress);
  const dayNo = getCurrentDayNo(progress, plan.durationDays);
  const path = getDailyPath(data.learningPaths, plan, dayNo);

  if (!path) {
    return buildFallbackTarget(data, progress, plan, reviewSummary);
  }

  const contentIds = unique(path.content_ids);
  const questionIds = unique(path.question_ids);
  const completedQuestionIds = new Set(Object.keys(progress.solvedQuestions || {}));
  const currentTarget = progress.currentDailyTarget || {};
  const currentTargetReviewQueueIds = currentTarget.dayNo === dayNo && currentTarget.durationDays === plan.durationDays
    ? unique(currentTarget.targetReviewQueueIds || [])
    : [];
  const reviewTargetCount = currentTargetReviewQueueIds.length || reviewSummary.totalDueCount;
  const completedDueReviewCount = currentTargetReviewQueueIds.length
    ? countCompletedTargetReviews(progress, currentTargetReviewQueueIds, currentTarget.startedAt)
    : 0;
  const completedLessonCount = contentIds.filter((lessonId) => isLessonFullyComplete(progress, { id: lessonId, relatedQuestionIds: [] })).length;
  const completedQuestionCount = questionIds.filter((questionId) => completedQuestionIds.has(questionId)).length;
  const totalTodayCount = contentIds.length + questionIds.length + reviewTargetCount;
  const completedTodayCount = completedLessonCount + completedQuestionCount + completedDueReviewCount;

  return {
    source: "learning-path",
    routeId: path.route_id,
    routeType: path.route_type,
    routeName: path.route_name || plan.label,
    pathId: path.path_id,
    dayNo,
    title: path.day_title || `${plan.label} Day ${dayNo}`,
    focus: path.learning_focus || "",
    subjectIds: unique(path.subject_ids),
    contentIds,
    questionIds,
    lessonCount: contentIds.length,
    questionCount: questionIds.length,
    completedLessonCount,
    completedQuestionCount,
    remainingLessonCount: Math.max(contentIds.length - completedLessonCount, 0),
    remainingQuestionCount: Math.max(questionIds.length - completedQuestionCount, 0),
    dueReviewCount: reviewTargetCount,
    dueQuestionCount: reviewSummary.dueQuestionCount,
    overdueReviewCount: reviewSummary.overdueCount,
    totalTodayCount,
    completedTodayCount,
    remainingTodayCount: Math.max(totalTodayCount - completedTodayCount, 0)
  };
}

export function buildStudyPlanSummary(data, progress) {
  const plan = getStudyPlan(progress);
  const totalQuestions = data.questions.length;
  const totalLessons = data.lessons.length;
  const completedLessons = data.lessons.filter((lesson) => isLessonFullyComplete(progress, lesson)).length;
  const solvedQuestionIds = new Set(Object.keys(progress.solvedQuestions || {}));
  const remainingQuestions = Math.max(totalQuestions - solvedQuestionIds.size, 0);
  const remainingLessons = Math.max(totalLessons - completedLessons, 0);
  const dailyTarget = buildDailyStudyTarget(data, progress);
  const scheduleProgress = buildScheduleProgress(data, progress, plan);
  const weeklyLessons = Math.max(1, Math.ceil((totalLessons / plan.durationDays) * 7));
  const daysPerLesson = totalLessons ? Math.max(1, Math.ceil(plan.durationDays / totalLessons)) : 1;
  const remainingDailyQuestions = remainingQuestions ? Math.max(1, Math.ceil(remainingQuestions / plan.durationDays)) : 0;
  const remainingWeeklyLessons = remainingLessons ? Math.max(1, Math.ceil((remainingLessons / plan.durationDays) * 7)) : 0;

  return {
    ...plan,
    totalQuestions,
    totalLessons,
    completedLessons,
    remainingQuestions,
    remainingLessons,
    dailyQuestions: dailyTarget.questionCount,
    weeklyLessons,
    daysPerLesson,
    remainingDailyQuestions,
    remainingWeeklyLessons,
    dueReviewCount: dailyTarget.dueReviewCount,
    dueQuestionCount: dailyTarget.dueQuestionCount,
    overdueReviewCount: dailyTarget.overdueReviewCount,
    recommendedNewQuestions: dailyTarget.remainingQuestionCount,
    scheduleProgress,
    dailyTarget
  };
}
