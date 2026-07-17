import { getQuestionById, loadAllData } from "./dataLoader.js";
import { buildMixedReviewItems } from "./frequencyReview.js";
import { getActiveExam, selectExamAnswer, startMockExam, submitMockExam } from "./mockExamEngine.js";
import { checkMemorizationAnswer, getMemorizationItems, saveMemorizationResult } from "./memorizationEngine.js";
import {
  buildReviewCounts,
  canStartMockExam,
  getCurrentSubject,
  getDueQuestionReviewItems,
  getLessonsBySubject,
  getNextSubject,
  getPendingLessonQuestionIds,
  getPendingWrongAnswers,
  getRelatedQuestionIds,
  getUnlockedSubjectIds,
  hasPendingMockExamWrongAnswers,
  hasPendingSubjectWrongAnswers,
  isLessonConceptComplete,
  isLessonFullyComplete,
  isLessonMemorizationPassed,
  isLessonQuizCompleted,
  MOCK_EXAM_SOURCE,
  SUBJECT_QUIZ_SOURCE
} from "./progression.js";
import { submitAnswer } from "./quizEngine.js";
import { getRoute, navigate } from "./router.js";
import { buildStudyPlanSummary, getStudyPlanOptions } from "./studyPlan.js";
import {
  getCloudAuthState,
  signInWithPassword,
  signUpWithPassword,
  signOutFromCloud,
  syncProgressAfterLogin
} from "./cloudSync.js";
import {
  getProgress,
  setProgress,
  clearProgress,
  markLessonCompleted,
  markLessonMemorizationPassed,
  markLessonQuestionAnswered,
  markLessonQuizCompleted,
  markSubjectWrongNoteCompleted,
  advanceCurrentDailyTarget,
  completeCurrentDailyTarget,
  saveDailyStudySession,
  saveCurrentDailyTarget,
  clearDailyStudySession,
  resetProgress,
  setStudyPlan,
  toggleBookmark
} from "./storage.js";

function percent(value) {
  return `${Math.round(value)}%`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function getQuestionImageUrl(image) {
  const config = window.__FIREBASE_CONFIG__ || {};
  const storagePath = image?.storage_path;
  if (storagePath && config.storageBucket) {
    return `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${encodeURIComponent(storagePath)}?alt=media`;
  }

  return image?.local_path || image?.url || "";
}

function renderQuestionImages(question) {
  const images = Array.isArray(question?.images) ? question.images : [];
  const markup = images
    .map((image, index) => {
      const src = getQuestionImageUrl(image);
      if (!src) return "";

      const alt = image.alt || `${question.id} 참고 이미지 ${index + 1}`;
      return `<img class="question-image" src="${src}" alt="${escapeHtml(alt)}" loading="lazy" referrerpolicy="no-referrer">`;
    })
    .join("");

  return markup ? `<div class="question-image-gallery">${markup}</div>` : "";
}

function typesetMath(root) {
  const mathJax = window.MathJax;
  if (!mathJax?.typesetPromise) {
    return;
  }

  mathJax.typesetClear?.([root]);
  mathJax.typesetPromise([root]).catch((error) => {
    console.warn("수식 렌더링에 실패했습니다.", error);
  });
}

function formatDateTime(value) {
  if (!value) {
    return "기록 없음";
  }

  return new Date(value).toLocaleString("ko-KR");
}

function isToday(value) {
  if (!value) {
    return false;
  }

  const date = new Date(value);
  const today = new Date();
  return date.getFullYear() === today.getFullYear()
    && date.getMonth() === today.getMonth()
    && date.getDate() === today.getDate();
}

function getTodayReviewedQueueIds(progress) {
  return new Set(
    Object.entries(progress.itemReviewState || {})
      .filter(([, state]) => isToday(state.lastReviewedAt) && state.lastReviewMode === "review-queue")
      .map(([queueId]) => queueId)
  );
}

function findSubjectName(subjects, subjectId) {
  return subjects.find((subject) => subject.id === subjectId)?.name || subjectId;
}

function findSubjectDescription(subjects, subjectId) {
  return subjects.find((subject) => subject.id === subjectId)?.description || "";
}

function findLessonById(lessons, lessonId) {
  return lessons.find((lesson) => lesson.id === lessonId) || null;
}

function createMemorizationSession(items, lessonId) {
  return {
    lessonId,
    itemIds: items.map((item) => item.id),
    currentIndex: 0,
    correctCount: 0
  };
}

function getSessionItem(session, availableItems) {
  if (!session) {
    return null;
  }

  const activeId = session.itemIds[session.currentIndex];
  return availableItems.find((item) => item.id === activeId) || null;
}

function memorizationTypeLabel(item) {
  if (item.type === "choice") {
    return "선택형";
  }
  if (item.type === "ox") {
    return "OX";
  }
  return "주관식";
}

function renderMemorizationAnswerField(item) {
  if (item.type === "choice") {
    return `
      <fieldset class="choice-list memorization-choice-list">
        ${item.choices
          .map(
            (choice) => `
              <label class="choice-item">
                <input type="radio" name="memorization-choice" value="${choice.value}">
                <span>${choice.label}</span>
              </label>
            `
          )
          .join("")}
      </fieldset>
    `;
  }

  if (item.type === "ox") {
    return `
      <fieldset class="choice-list memorization-choice-list">
        <label class="choice-item">
          <input type="radio" name="memorization-choice" value="O">
          <span>O</span>
        </label>
        <label class="choice-item">
          <input type="radio" name="memorization-choice" value="X">
          <span>X</span>
        </label>
      </fieldset>
    `;
  }

  return `
    <label>
      <span>정답 입력</span>
      <input type="text" id="memorization-answer" placeholder="기억나는 답을 입력하세요">
    </label>
  `;
}

function readMemorizationAnswer(item) {
  if (item.type === "choice" || item.type === "ox") {
    return document.querySelector('input[name="memorization-choice"]:checked')?.value || "";
  }

  return document.querySelector("#memorization-answer")?.value || "";
}

function getSelectedSubjectId(data, progress, requestedSubjectId) {
  const unlockedSubjectIds = getUnlockedSubjectIds(data, progress);
  if (requestedSubjectId && unlockedSubjectIds.includes(requestedSubjectId)) {
    return requestedSubjectId;
  }

  return getCurrentSubject(data, progress)?.id || data.subjects[0]?.id || null;
}

function buildSubjectLockMessage(data, progress, selectedSubjectId) {
  const unlockedSubjectIds = getUnlockedSubjectIds(data, progress);
  if (unlockedSubjectIds.length === data.subjects.length) {
    return "";
  }

  const currentSubject = getCurrentSubject(data, progress);
  const selectedSubjectName = findSubjectName(data.subjects, selectedSubjectId);
  const currentSubjectName = currentSubject?.name || selectedSubjectName;

  return `${selectedSubjectName} 과목을 완료하셔야 다음 과목으로 넘어갈 수 있습니다. 현재는 ${currentSubjectName}부터 순차 진행됩니다.`;
}

function getSelectedLesson(lessons, progress, requestedLessonId) {
  return (
    lessons.find((lesson) => lesson.id === requestedLessonId) ||
    lessons.find((lesson) => !isLessonConceptComplete(progress, lesson.id)) ||
    lessons.find((lesson) => !isLessonMemorizationPassed(progress, lesson.id)) ||
    lessons.find((lesson) => !isLessonQuizCompleted(progress, lesson)) ||
    lessons[0] ||
    null
  );
}

function getDailyConceptLessons(lessons, dailyLessonIds) {
  const dailyLessons = lessons.filter((lesson) => dailyLessonIds.has(lesson.id));
  return dailyLessons.length ? dailyLessons : lessons;
}

function getLessonStageText(progress, lesson) {
  if (!isLessonConceptComplete(progress, lesson.id)) {
    return "개념 학습";
  }
  if (!isLessonMemorizationPassed(progress, lesson.id)) {
    return "암기 확인";
  }
  if (!isLessonQuizCompleted(progress, lesson)) {
    return "기출 풀이";
  }
  return "완료";
}

function getQuestionPool(data, state, selectedSubjectId) {
  if (state.quizSession?.questionIds?.length) {
    const questionIdSet = new Set(state.quizSession.questionIds);
    return data.questions.filter((question) => questionIdSet.has(question.id));
  }

  return data.questions.filter((question) => question.subjectId === selectedSubjectId);
}

function getQuizAdvanceLabel(state) {
  if (!state.quizSession) {
    return "다음 문제";
  }

  return state.quizSession.questionIds.length > 1 ? "다음 문제" : "다음 단계";
}

function startLessonQuizSession(state, progress, lesson) {
  const pendingQuestionIds = getPendingLessonQuestionIds(progress, lesson);
  const questionIds = pendingQuestionIds.length ? pendingQuestionIds : getRelatedQuestionIds(lesson);

  state.quizSession = {
    mode: "lesson-quiz",
    subjectId: lesson.subjectId,
    lessonId: lesson.id,
    sourceType: SUBJECT_QUIZ_SOURCE,
    sourceId: lesson.subjectId,
    questionIds,
    totalQuestionIds: questionIds
  };
  state.selectedQuestionId = questionIds[0] || null;
  state.quizResult = null;
  return questionIds;
}

function startWrongAnswerReviewSession(state, item) {
  state.quizSession = {
    mode: "wrong-note",
    subjectId: item.subjectId,
    lessonId: item.lessonId || null,
    sourceType: item.sourceType,
    sourceId: item.sourceId,
    questionIds: [item.questionId]
  };
  state.selectedSubjectId = item.subjectId;
  state.selectedQuestionId = item.questionId;
  state.quizResult = null;
}

function resetQuizSession(state) {
  state.quizSession = null;
}

function clearReviewMode(state) {
  state.reviewMode = false;
  state.reviewFilters = null;
}

function getTodayKey() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function isCurrentDailySession(session) {
  return Boolean(session && session.status !== "completed");
}

function getCurrentTargetReviewQueueIds(progress) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIso = today.toISOString();
  return progress.reviewQueue
    ?.filter((item) => item.itemType === "question" && item.status === "pending" && item.dueAt && item.dueAt <= todayIso)
    .map((item) => item.queueId) || [];
}

function persistCurrentDailyTarget(target, progress, durationDays) {
  const existing = progress.currentDailyTarget || {};
  saveCurrentDailyTarget({
    durationDays,
    dayNo: target.dayNo,
    routeId: target.routeId || null,
    pathId: target.pathId || null,
    targetLessonIds: target.contentIds || [],
    targetQuestionIds: target.questionIds || [],
    targetReviewQueueIds: existing.dayNo === target.dayNo && existing.targetReviewQueueIds
      ? existing.targetReviewQueueIds
      : getCurrentTargetReviewQueueIds(progress),
    startedAt: existing.dayNo === target.dayNo ? existing.startedAt || new Date().toISOString() : new Date().toISOString(),
    completedAt: null
  });
}

function maybeCompleteCurrentDailyTarget(data, progress) {
  const planSummary = buildStudyPlanSummary(data, progress);
  const target = planSummary.dailyTarget;
  if (!target.totalTodayCount || target.remainingTodayCount > 0) {
    return progress;
  }

  return completeCurrentDailyTarget(target.dayNo, planSummary.durationDays);
}

function advanceCompletedDailyTargetForStart(data, progress) {
  const planSummary = buildStudyPlanSummary(data, progress);
  const target = planSummary.dailyTarget;
  const currentTarget = progress.currentDailyTarget || {};
  if (
    target.totalTodayCount
    && target.remainingTodayCount === 0
    && currentTarget.completedAt
    && Number(currentTarget.dayNo) === Number(target.dayNo)
  ) {
    return advanceCurrentDailyTarget(target.dayNo, planSummary.durationDays);
  }

  return progress;
}

async function continueDailyTargetAfterLessonQuiz(data, progress, state, lesson) {
  markLessonQuizCompleted(lesson.id);
  const latestProgress = maybeCompleteCurrentDailyTarget(data, getProgress());
  const target = buildStudyPlanSummary(data, latestProgress).dailyTarget;
  const dailyLessons = data.lessons.filter((entry) => target.contentIds.includes(entry.id));
  const nextDailyLesson = dailyLessons.find((entry) => !isLessonFullyComplete(latestProgress, entry));

  if (!nextDailyLesson) {
    navigate("home");
    return;
  }

  state.selectedSubjectId = nextDailyLesson.subjectId;
  state.selectedLessonId = nextDailyLesson.id;
  await startDailyLearning(data, latestProgress, state);
}

function updateDailyStudySession(lessonId, updates) {
  const progress = getProgress();
  const session = progress.dailyStudySession;
  if (!isCurrentDailySession(session) || session.lessonId !== lessonId) {
    return;
  }

  saveDailyStudySession({
    ...session,
    ...updates,
    updatedAt: new Date().toISOString()
  });
}

function clearDailyStudySessionForLesson(lessonId) {
  const progress = getProgress();
  if (isCurrentDailySession(progress.dailyStudySession) && progress.dailyStudySession.lessonId === lessonId) {
    clearDailyStudySession();
  }
}

function getDailyLessonQuestionIds(target, lesson) {
  const relatedQuestionIds = getRelatedQuestionIds(lesson);
  const targetQuestionIds = new Set(target.questionIds || []);
  const scopedQuestionIds = relatedQuestionIds.filter((questionId) => targetQuestionIds.has(questionId));
  return scopedQuestionIds.length ? scopedQuestionIds : relatedQuestionIds;
}

function createDailyStudySession(target, lesson, stage, questionIds = []) {
  return {
    dayKey: getTodayKey(),
    routeId: target.routeId || null,
    dayNo: target.dayNo,
    lessonId: lesson.id,
    stage,
    questionIds,
    totalQuestionIds: questionIds,
    selectedQuestionId: questionIds[0] || null,
    memorizationItemId: null,
    memorizationCurrentIndex: 0,
    memorizationCorrectCount: 0,
    updatedAt: new Date().toISOString()
  };
}

function startLessonQuizState(state, lesson, questionIds) {
  state.quizSession = {
    mode: "lesson-quiz",
    subjectId: lesson.subjectId,
    lessonId: lesson.id,
    sourceType: SUBJECT_QUIZ_SOURCE,
    sourceId: lesson.subjectId,
    questionIds,
    totalQuestionIds: questionIds
  };
  state.selectedSubjectId = lesson.subjectId;
  state.selectedLessonId = lesson.id;
  state.selectedQuestionId = questionIds[0] || null;
  state.quizResult = null;
}

async function startDailyLearning(data, progress, state) {
  const activeProgress = advanceCompletedDailyTargetForStart(data, progress);
  const planSummary = buildStudyPlanSummary(data, activeProgress);
  const target = planSummary.dailyTarget;
  persistCurrentDailyTarget(target, activeProgress, planSummary.durationDays);
  const dailyLessons = data.lessons.filter((lesson) => target.contentIds.includes(lesson.id));
  let session = isCurrentDailySession(activeProgress.dailyStudySession) ? activeProgress.dailyStudySession : null;
  let lesson = session ? data.lessons.find((entry) => entry.id === session.lessonId) : null;

  if (!lesson || !dailyLessons.some((entry) => entry.id === lesson.id)) {
    lesson = dailyLessons.find((entry) => !isLessonFullyComplete(activeProgress, entry)) || dailyLessons[0];
    if (!lesson) {
      navigate("progress");
      return;
    }

    const questionIds = getDailyLessonQuestionIds(target, lesson);
    session = createDailyStudySession(
      target,
      lesson,
      !isLessonConceptComplete(activeProgress, lesson.id)
        ? "concept"
        : !isLessonMemorizationPassed(activeProgress, lesson.id)
          ? "memorization"
          : "quiz",
      questionIds
    );
  }

  state.selectedSubjectId = lesson.subjectId;
  state.selectedLessonId = lesson.id;

  if (session.stage === "concept" && !isLessonConceptComplete(activeProgress, lesson.id)) {
    saveDailyStudySession(session);
    navigate("concept");
    return;
  }

  if (session.stage !== "quiz" && !isLessonMemorizationPassed(activeProgress, lesson.id)) {
    const items = getMemorizationItems(data.lessons).filter((item) => item.lessonId === lesson.id);
    const currentIndex = Math.min(session.memorizationCurrentIndex || 0, Math.max(items.length - 1, 0));
    state.memorizationSession = {
      lessonId: lesson.id,
      itemIds: items.map((item) => item.id),
      currentIndex,
      correctCount: session.memorizationCorrectCount || 0
    };
    state.selectedMemorizationItemId = session.memorizationItemId || items[currentIndex]?.id || null;
    state.memorizationResult = null;
    saveDailyStudySession({
      ...session,
      stage: "memorization",
      memorizationItemId: state.selectedMemorizationItemId,
      memorizationCurrentIndex: currentIndex
    });
    navigate("memorization");
    return;
  }

  const completedQuestionIds = new Set(activeProgress.lessonProgress?.[lesson.id]?.completedQuestionIds || []);
  const allQuestionIds = session.totalQuestionIds?.length
    ? session.totalQuestionIds
    : getDailyLessonQuestionIds(target, lesson);
  const questionIds = allQuestionIds.filter((questionId) => !completedQuestionIds.has(questionId));

  if (!questionIds.length) {
    clearDailyStudySession();
    markLessonQuizCompleted(lesson.id);
    maybeCompleteCurrentDailyTarget(data, getProgress());
    navigate("home");
    return;
  }

  const nextSession = {
    ...session,
    stage: "quiz",
    questionIds,
    totalQuestionIds: allQuestionIds,
    selectedQuestionId: questionIds[0],
    updatedAt: new Date().toISOString()
  };
  saveDailyStudySession(nextSession);
  startLessonQuizState(state, lesson, questionIds);
  navigate("quiz");
}

function startDueReviewSession(state, progress, data, selectedQuestionId = null, options = {}) {
  const reviewItems = buildMixedReviewItems(data, progress, options);
  if (!reviewItems.length) {
    clearReviewMode(state);
    navigate("home");
    return false;
  }

  const selectedItem = reviewItems.find((item) => item.itemId === selectedQuestionId);
  const orderedItems = selectedItem
    ? [selectedItem, ...reviewItems.filter((item) => item.itemId !== selectedQuestionId)]
    : reviewItems;
  const nextItem = orderedItems[0];

  state.reviewMode = true;
  state.reviewFilters = { ...options };
  state.selectedSubjectId = nextItem.subjectId;
  state.selectedLessonId = nextItem.lessonId || null;
  state.quizResult = null;
  state.memorizationResult = null;
  state.selectedQuestionId = nextItem.itemId;
  state.quizSession = {
    mode: "review-queue",
    subjectId: nextItem.subjectId,
    lessonId: nextItem.lessonId || null,
    sourceType: nextItem.sourceType,
    sourceId: nextItem.sourceId,
    reason: nextItem.reason,
    frequencyCount: nextItem.frequencyCount || null,
    questionIds: orderedItems.map((item) => item.itemId),
    totalQuestionIds: orderedItems.map((item) => item.itemId),
    reviewItems: orderedItems.map((item) => ({
      questionId: item.itemId,
      sourceType: item.sourceType,
      sourceId: item.sourceId,
      lessonId: item.lessonId || null,
      reason: item.reason
    }))
  };
  navigate("quiz");
  return true;
}

function getNextLessonInSubject(data, progress, subjectId) {
  const lessons = getLessonsBySubject(data, subjectId);
  return (
    lessons.find((lesson) => !isLessonConceptComplete(progress, lesson.id)) ||
    lessons.find((lesson) => !isLessonMemorizationPassed(progress, lesson.id)) ||
    lessons.find((lesson) => !isLessonQuizCompleted(progress, lesson)) ||
    null
  );
}

function advanceToNextSubjectOrMock(data, progress, state, subjectId) {
  const nextSubject = getNextSubject(data, subjectId);
  if (nextSubject) {
    state.selectedSubjectId = nextSubject.id;
    state.selectedLessonId = getNextLessonInSubject(data, progress, nextSubject.id)?.id || null;
    navigate("concept");
    return;
  }

  if (canStartMockExam(data, progress)) {
    navigate("mock-exam");
    return;
  }

  navigate("progress");
}

function completeLessonQuizFlow(data, progress, state, lesson) {
  markLessonQuizCompleted(lesson.id);
  const nextProgress = getProgress();
  const nextLesson = getNextLessonInSubject(data, nextProgress, lesson.subjectId);

  if (nextLesson) {
    state.selectedSubjectId = lesson.subjectId;
    state.selectedLessonId = nextLesson.id;
    navigate("concept");
    return;
  }

  if (hasPendingSubjectWrongAnswers(nextProgress, lesson.subjectId)) {
    state.wrongNoteScope = "subject";
    state.wrongNoteSubjectId = lesson.subjectId;
    navigate("wrong-note");
    return;
  }

  markSubjectWrongNoteCompleted(lesson.subjectId);
  advanceToNextSubjectOrMock(data, getProgress(), state, lesson.subjectId);
}

function getSubjectProgressSummary(data, progress, subjectId) {
  const lessons = getLessonsBySubject(data, subjectId);
  const completedLessons = lessons.filter((lesson) => isLessonFullyComplete(progress, lesson)).length;

  return {
    lessonCount: lessons.length,
    completedLessons,
    pendingWrongCount: getPendingWrongAnswers(progress, {
      subjectId,
      sourceType: SUBJECT_QUIZ_SOURCE
    }).length
  };
}

function computeStats(data, progress) {
  const completedCount = data.lessons.filter((lesson) => isLessonMemorizationPassed(progress, lesson.id)).length;
  const lessonProgress = data.lessons.length ? (completedCount / data.lessons.length) * 100 : 0;
  const solvedRecords = Object.values(progress.solvedQuestions);
  const correctCount = solvedRecords.filter((item) => item.isCorrect).length;
  const accuracy = solvedRecords.length ? (correctCount / solvedRecords.length) * 100 : 0;
  const lastStudyDate =
    solvedRecords
      .map((item) => item.lastSolvedAt)
      .sort()
      .at(-1) || null;
  const reviewCounts = buildReviewCounts(progress);

  return {
    completedCount,
    lessonProgress,
    solvedCount: solvedRecords.length,
    correctCount,
    wrongCount: progress.wrongAnswers.filter((item) => item.reviewStatus === "pending").length,
    accuracy,
    lastStudyDate,
    dueReviewCount: reviewCounts.totalDueCount,
    dueQuestionCount: reviewCounts.dueQuestionCount,
    overdueReviewCount: reviewCounts.overdueCount
  };
}

function subjectProgressRows(data, progress) {
  return data.subjects
    .map((subject) => {
      const summary = getSubjectProgressSummary(data, progress, subject.id);
      const ratio = summary.lessonCount ? (summary.completedLessons / summary.lessonCount) * 100 : 0;

      return `
        <div class="subject-progress-row">
          <div>
            <strong>${subject.name}</strong>
            <p>${subject.description}</p>
          </div>
          <div class="subject-progress-meta">
            <span>${summary.completedLessons}/${summary.lessonCount} lesson 완료</span>
            <div class="progress-track"><span style="width:${ratio}%"></span></div>
            <strong>${percent(ratio)}</strong>
          </div>
        </div>
      `;
    })
    .join("");
}

function computeSubjectAccuracyRows(data, progress) {
  return data.subjects.map((subject) => {
    const subjectQuestionIds = new Set(
      data.questions
        .filter((question) => question.subjectId === subject.id)
        .map((question) => question.id)
    );
    const subjectRecords = Object.values(progress.solvedQuestions).filter((record) =>
      subjectQuestionIds.has(record.questionId)
    );
    const correct = subjectRecords.filter((record) => record.isCorrect).length;
    const total = subjectRecords.length;
    const ratio = total ? (correct / total) * 100 : 0;

    return {
      subjectId: subject.id,
      total,
      correct,
      ratio
    };
  });
}

function stitchNavItems() {
  return [
    ["home", "대시보드"],
    ["concept", "개념 학습"],
    ["memorization", "암기 학습"],
    ["wrong-note", "복습 학습"],
    ["mock-exam", "모의고사"],
    ["progress", "학습 현황"],
    ["settings", "설정"]
  ];
}

function stitchLayout(title, activeRoute, body, meta = "") {
  return `
    <div class="app-shell route-${activeRoute}">
      <header class="app-header">
        <div class="header-copy">
          <p class="eyebrow">JT Academy</p>
          <h1>${title}</h1>
          <p class="header-description">신규 학습과 기출 기반 복습을 분리해 운영하는 소방설비기사 학습 앱입니다.</p>
        </div>
      </header>
      <nav class="app-nav">
        ${navItems()
          .map(
            ([route, label]) => `
              <button class="nav-tab ${activeRoute === route ? "is-active" : ""}" data-route="${route}">
                ${label}
              </button>
            `
          )
          .join("")}
      </nav>
      ${meta ? `<section class="meta-banner">${meta}</section>` : ""}
      <main class="page-content">${body}</main>
    </div>
  `;
}

function renderRouteCards(data, progress) {
  return data.subjects
    .map((subject) => {
      const summary = getSubjectProgressSummary(data, progress, subject.id);
      const nextLesson = getNextLessonInSubject(data, progress, subject.id) || getLessonsBySubject(data, subject.id)[0];

      return `
        <article class="route-card">
          <div>
            <p class="route-day">${subject.name}</p>
            <h3>${nextLesson?.title || "과목 완료"}</h3>
            <p class="route-goal">${subject.description}</p>
            <div class="route-meta">
              <span>${summary.completedLessons}/${summary.lessonCount} lesson 완료</span>
              <span>오답 ${summary.pendingWrongCount}개</span>
            </div>
          </div>
          <button class="action-button" data-route="concept" data-subject-id="${subject.id}">
            바로 이어서
          </button>
        </article>
      `;
    })
    .join("");
}

function renderHome(data, progress) {
  const stats = computeStats(data, progress);
  const currentSubject = getCurrentSubject(data, progress);
  const nextLesson = currentSubject ? getNextLessonInSubject(data, progress, currentSubject.id) : null;
  const planSummary = buildStudyPlanSummary(data, progress);
  const hasDueReviews = planSummary.dueReviewCount > 0;
  const dueItems = getDueQuestionReviewItems(progress).slice(0, 3);

  return layout(
    "소방설비기사(전기)",
    "home",
    `
      <section class="hero-panel">
        <div>
          <p class="eyebrow hero-eyebrow">현재 과목</p>
          <h2>${currentSubject ? currentSubject.name : "전체 학습 완료"}</h2>
          <p>${
            nextLesson
              ? `다음 lesson은 "${nextLesson.title}"입니다. 신규 학습과 오늘 due 기출 복습을 함께 처리합니다.`
              : "모든 신규 lesson이 완료되었습니다. 복습과 모의고사 단계 중심으로 진행하면 됩니다."
          }</p>
          <div class="hero-actions">
            <button class="action-button" data-route="concept" data-subject-id="${currentSubject?.id || data.subjects[0]?.id || ""}">학습 시작</button>
            <button class="ghost-action-button" data-action="start-due-review" ${hasDueReviews ? "" : "disabled"}>오늘 due 복습 시작</button>
          </div>
        </div>
        <aside class="summary-card summary-card-strong">
          <h3>오늘 요약</h3>
          <div class="summary-stats">
            <div><strong>${stats.completedCount}</strong><span>개념 완료</span></div>
            <div><strong>${stats.dueReviewCount}</strong><span>오늘 복습</span></div>
            <div><strong>${percent(stats.accuracy)}</strong><span>정답률</span></div>
          </div>
          <div class="summary-stats">
            <div><strong>${stats.overdueReviewCount}</strong><span>밀린 복습</span></div>
            <div><strong>${planSummary.recommendedNewQuestions}</strong><span>오늘 신규 기출</span></div>
            <div><strong>${planSummary.weeklyLessons}</strong><span>주간 pace</span></div>
          </div>
          <p class="summary-note">학습 진행도는 로그인한 Firebase 계정에 저장됩니다.</p>
        </aside>
      </section>

      <section class="content-grid content-grid-main">
        <section class="panel-card">
          <div class="section-head">
            <div>
              <p class="eyebrow">신규 학습 루트</p>
              <h2>${currentSubject ? currentSubject.name : "신규 학습 완료"}</h2>
            </div>
          </div>
          <p>${nextLesson ? `다음 lesson: ${nextLesson.title}` : "현재 남아 있는 신규 lesson이 없습니다."}</p>
          <p class="helper-text">오늘 권장 신규 기출 수량: ${planSummary.recommendedNewQuestions}문항</p>
          ${renderRouteCards(data, progress)}
        </section>

        <aside class="stack-column">
          <section class="summary-card">
            <h3>오늘의 복습 학습</h3>
            <strong>${planSummary.dueReviewCount}문항 due</strong>
            <p>기출 복습 ${planSummary.dueQuestionCount}문항</p>
            <p class="helper-text">밀린 복습 ${planSummary.overdueReviewCount}문항을 우선 처리합니다.</p>
            <div class="inline-actions">
              <button class="action-button" data-action="start-due-review" ${hasDueReviews ? "" : "disabled"}>바로 풀기</button>
              <button class="ghost-action-button" data-route="wrong-note">복습 상세 보기</button>
            </div>
          </section>
          <section class="summary-card">
            <h3>${planSummary.label}</h3>
            <strong>총 기출 ${planSummary.totalQuestions}문항</strong>
            <p>30일과 60일 모두 총 기출량은 같고, 하루 권장 물량과 pace만 달라집니다.</p>
            <p class="helper-text">복습 물량이 많아지면 신규 권장량은 자동으로 줄어듭니다.</p>
          </section>
          <section class="summary-card">
            <h3>복습 큐</h3>
            ${
              dueItems.length
                ? dueItems
                    .map(
                      (item) => `
                        <div class="history-row">
                          <div>
                            <strong>${findSubjectName(data.subjects, item.subjectId)}</strong>
                            <p>${item.reason === "wrong" ? "오답 우선" : "간격 복습"} / ${formatDateTime(item.dueAt)}</p>
                          </div>
                          <button class="chip-action-button" data-action="start-due-review">시작</button>
                        </div>
                      `
                    )
                    .join("")
                : "<p>현재 대기 중인 due 기출이 없습니다.</p>"
            }
          </section>
        </aside>
      </section>

      <section class="panel-card">
        <div class="section-head">
          <div>
            <p class="eyebrow">과목 진도</p>
            <h2>전체 학습 현황</h2>
          </div>
        </div>
      </section>

      <section class="panel-card">
        ${subjectProgressRows(data, progress)}
      </section>
    `
  );
}

function renderConcept(data, progress, state) {
  const selectedSubjectId = getSelectedSubjectId(data, progress, state.selectedSubjectId);
  const lessons = getLessonsBySubject(data, selectedSubjectId);
  const dailyTarget = buildStudyPlanSummary(data, progress).dailyTarget;
  const dailyLessonIds = new Set(dailyTarget.contentIds || []);
  const visibleLessons = getDailyConceptLessons(lessons, dailyLessonIds);

  if (!lessons.length) {
    return layout(
      "개념 학습",
      "concept",
      `
        <section class="empty-panel">
          <strong>표시할 lesson이 없습니다.</strong>
          <p>현재 과목에는 학습 데이터가 없습니다.</p>
        </section>
      `
    );
  }

  const selectedLesson = getSelectedLesson(visibleLessons, progress, state.selectedLessonId);
  const unlockedSubjectIds = getUnlockedSubjectIds(data, progress);
  const currentSubject = getCurrentSubject(data, progress);
  const subjectLockMessage = buildSubjectLockMessage(data, progress, selectedSubjectId);
  const relatedQuestionIds = getRelatedQuestionIds(selectedLesson);
  const pendingQuestionIds = getPendingLessonQuestionIds(progress, selectedLesson);
  const lessonCards = (selectedLesson.conceptCards || [])
    .map(
      (card) => `
        <article class="concept-card">
          <div class="concept-card-header">
            <p class="eyebrow">${selectedLesson.title}</p>
            <h3>${card.title}</h3>
          </div>
          <p class="concept-card-body">${card.body}</p>
          <div class="tag-list concept-card-tags">
            ${(card.keywords || []).map((keyword) => `<span class="tag-chip">${keyword}</span>`).join("")}
          </div>
        </article>
      `
    )
    .join("");

  return layout(
    "개념 학습",
    "concept",
    `
      <section class="controls-card">
        <label>
          <span>과목 선택</span>
          <select data-action="select-subject">
            ${data.subjects
              .map(
                (subject) => `
                  <option value="${subject.id}" ${subject.id === selectedSubjectId ? "selected" : ""} ${!unlockedSubjectIds.includes(subject.id) ? "disabled" : ""}>${subject.name}${!unlockedSubjectIds.includes(subject.id) ? " (이전 과목 완료 후 열림)" : ""}</option>
                `
              )
              .join("")}
          </select>
        </label>
        ${
          subjectLockMessage
            ? `<p class="helper-text">${subjectLockMessage}</p>`
            : ""
        }
      </section>

      <section class="content-grid content-grid-main">
        <aside class="panel-card">
          <div class="section-head">
            <div>
              <p class="eyebrow">과목 개요</p>
              <h2>${findSubjectName(data.subjects, selectedSubjectId)}</h2>
            </div>
          </div>
          <p>${findSubjectDescription(data.subjects, selectedSubjectId)}</p>
          <p class="helper-text">현재 진행 과목: ${currentSubject?.name || findSubjectName(data.subjects, selectedSubjectId)}</p>
          <div class="lesson-list">
            ${visibleLessons
              .map(
                (lesson) => {
                  const isTodayLessonComplete =
                    dailyLessonIds.has(lesson.id) && isLessonFullyComplete(progress, lesson);

                  return `
                  <button class="lesson-list-item ${lesson.id === selectedLesson.id ? "is-active" : ""}" data-action="select-lesson" value="${lesson.id}">
                    <span class="lesson-list-title-row">
                      <strong>${lesson.title}</strong>
                      ${isTodayLessonComplete ? '<span class="status-pill is-success">완료</span>' : ""}
                    </span>
                    <span>${lesson.summary}</span>
                    <span class="helper-text">${getLessonStageText(progress, lesson)}</span>
                  </button>
                  `;
                }
              )
              .join("")}
          </div>
        </aside>

        <div class="stack-column">
          <section class="panel-card lesson-overview-card">
            <p class="eyebrow">${selectedLesson.level}</p>
            <h2>${selectedLesson.title}</h2>
            <p>${selectedLesson.summary}</p>
            <div class="inline-actions">
              <button class="action-button" data-action="complete-lesson" data-lesson-id="${selectedLesson.id}">
                ${isLessonConceptComplete(progress, selectedLesson.id) ? "암기 단계로 다시 시작" : "개념 학습 완료"}
              </button>
              <span class="status-pill ${isLessonFullyComplete(progress, selectedLesson) ? "is-success" : ""}">
                ${getLessonStageText(progress, selectedLesson)}
              </span>
            </div>
          </section>

          <section class="concept-card-stack">
            ${lessonCards}
          </section>

          <section class="panel-card">
            <div class="section-head">
              <div>
                <p class="eyebrow">연결 문제</p>
                <h3>해당 lesson 기출 문제</h3>
              </div>
            </div>
            ${
              relatedQuestionIds.length
                ? `
                  <div class="tag-list">
                    ${relatedQuestionIds
                      .map(
                        (questionId) => `
                          <span class="tag-chip">
                            ${questionId}
                          </span>
                        `
                      )
                      .join("")}
                  </div>
                  <p class="helper-text">남은 lesson 기출 ${pendingQuestionIds.length || relatedQuestionIds.length}문항</p>
                `
                : "<p class='helper-text'>이 lesson은 암기 통과 후 바로 다음 lesson으로 진행합니다.</p>"
            }
          </section>
        </div>
      </section>
    `
  );
}

function renderMemorization(data, progress, state) {
  const selectedSubjectId = getSelectedSubjectId(data, progress, state.selectedSubjectId);
  const lessons = getLessonsBySubject(data, selectedSubjectId);
  const items = getMemorizationItems(lessons);
  const inferredLessonId = state.selectedMemorizationItemId
    ? items.find((item) => item.id === state.selectedMemorizationItemId)?.lessonId || null
    : null;
  const activeLessonId = state.selectedLessonId || inferredLessonId || null;
  const focusedItems = activeLessonId ? items.filter((item) => item.lessonId === activeLessonId) : [];
  const availableItems = focusedItems.length ? focusedItems : items;
  const session =
    state.memorizationSession && state.memorizationSession.lessonId === activeLessonId
      ? state.memorizationSession
      : null;
  const activeItem =
    getSessionItem(session, availableItems) ||
    availableItems.find((item) => item.id === state.selectedMemorizationItemId) ||
    availableItems[0];
  const result = state.memorizationResult;
  const stats = activeItem ? progress.memorizationStats[activeItem.id] : null;
  const currentLesson = findLessonById(lessons, activeItem?.lessonId);
  const lessonItemCount = activeItem ? items.filter((item) => item.lessonId === activeItem.lessonId).length : availableItems.length;
  const sessionTotal = session?.itemIds.length || focusedItems.length || lessonItemCount;
  const sessionStep = session ? session.currentIndex + 1 : activeItem?.itemIndex || 1;
  const canStudyMemorization = currentLesson ? isLessonConceptComplete(progress, currentLesson.id) : false;

  if (!activeItem) {
    return layout(
      "암기 학습",
      "memorization",
      `
        <section class="empty-panel">
          <strong>암기 문항이 없습니다.</strong>
          <p>현재 과목에는 준비된 암기 문항이 없습니다.</p>
        </section>
      `
    );
  }

  if (!canStudyMemorization) {
    return layout(
      "암기 학습",
      "memorization",
      `
      <section class="empty-panel">
        <strong>개념학습을 완료후 학습이 진행됩니다. 완료 버튼을 반드시 눌러주세요.</strong>
        <p>${currentLesson ? `"${currentLesson.title}" 개념학습 화면에서 완료 버튼을 누른 뒤 암기 학습을 진행할 수 있습니다.` : "먼저 개념학습을 완료해 주세요."}</p>
        <button class="action-button" data-route="concept" data-subject-id="${selectedSubjectId}" data-lesson-id="${currentLesson?.id || ""}">개념학습으로 이동</button>
      </section>
      `
    );
  }

  return layout(
    "암기 학습",
    "memorization",
    `
      <section class="controls-card double-controls">
        <label>
          <span>과목 선택</span>
          <select data-action="select-memorization-subject">
            ${getUnlockedSubjectIds(data, progress)
              .map(
                (subjectId) => `
                  <option value="${subjectId}" ${subjectId === selectedSubjectId ? "selected" : ""}>${findSubjectName(data.subjects, subjectId)}</option>
                `
              )
              .join("")}
          </select>
        </label>
        <label>
          <span>문항 선택</span>
          <select data-action="select-memorization-item">
            ${availableItems
              .map(
                (item) => `
                  <option value="${item.id}" ${item.id === activeItem.id ? "selected" : ""}>${item.lessonTitle} - ${item.itemIndex}번</option>
                `
              )
              .join("")}
          </select>
        </label>
      </section>

      <section class="content-grid content-grid-main">
        <div class="panel-card">
          <p class="eyebrow">${activeItem.lessonTitle}</p>
          <h2>${activeItem.prompt}</h2>
          <p class="helper-text">문항 형식: ${memorizationTypeLabel(activeItem)}${activeItem.answerLabel ? ` / 확인 내용: ${activeItem.answerLabel}` : ""}</p>
          <p class="helper-text">현재 ${sessionStep} / ${sessionTotal} 문항</p>
          ${renderMemorizationAnswerField(activeItem)}
          <div class="inline-actions">
            <button class="action-button" data-action="submit-memorization" data-item-id="${activeItem.id}">채점하기</button>
            <button class="ghost-action-button" data-action="fill-hint">힌트 보기</button>
            ${result ? `<button class="ghost-action-button" data-action="advance-memorization" data-item-id="${activeItem.id}">다음 문제</button>` : ""}
          </div>
          ${activeItem.acceptableAnswers?.length ? `<p class="helper-text">허용 답안: ${activeItem.acceptableAnswers.join(", ")}</p>` : ""}
          ${
            result
              ? `
                <section class="feedback-panel ${result.isCorrect ? "is-correct" : "is-wrong"}">
                  <strong>${result.isCorrect ? "정답입니다." : "재학습이 필요합니다."}</strong>
                  <p>정답: ${activeItem.answer}</p>
                  <p>힌트: ${activeItem.hint}</p>
                </section>
              `
              : ""
          }
        </div>

        <aside class="stack-column">
          <section class="summary-card">
            <h3>암기 통계</h3>
            <div class="summary-stats">
              <div><strong>${stats?.attempts || 0}</strong><span>시도</span></div>
              <div><strong>${stats?.correctCount || 0}</strong><span>정답</span></div>
              <div><strong>${stats?.wrongCount || 0}</strong><span>오답</span></div>
            </div>
          </section>
          <section class="summary-card">
            <h3>현재 규칙</h3>
            <p>${currentLesson ? `${currentLesson.title} lesson의 암기 단계입니다.` : ""}</p>
            <p class="helper-text">같은 lesson의 모든 암기 문항을 풀면 정답률과 관계없이 해당 기출 문제로 이동합니다.</p>
          </section>
        </aside>
      </section>
    `
  );
}

function renderExamSubjectSummary(data, subjectScores) {
  return Object.entries(subjectScores)
    .map(([subjectId, score]) => {
      const ratio = score.total ? (score.correct / score.total) * 100 : 0;
      return `
        <div class="subject-score-card">
          <strong>${findSubjectName(data.subjects, subjectId)}</strong>
          <p>${score.correct}/${score.total} 정답</p>
          <div class="progress-track"><span style="width:${ratio}%"></span></div>
        </div>
      `;
    })
    .join("");
}

function renderMockExam(data, progress, state) {
  if (!canStartMockExam(data, progress)) {
    return layout(
      "모의고사",
      "mock-exam",
      `
        <section class="empty-panel">
          <strong>아직 모의고사를 시작할 수 없습니다.</strong>
          <p>모든 과목의 신규 학습과 과목 오답노트를 완료한 뒤 모의고사가 열립니다.</p>
        </section>
      `
    );
  }

  const activeExam = getActiveExam();
  const mockExams = Array.isArray(data.mockExam) ? data.mockExam : [data.mockExam];
  const selectedMockExam = mockExams.find((exam) => exam.id === state.selectedMockExamId) || mockExams[0];
  const latestResult = state.mockExamResult || progress.mockExamHistory.find((result) => result.examId === selectedMockExam?.id) || progress.mockExamHistory[0] || null;

  if (!activeExam) {
    return layout(
      "모의고사",
      "mock-exam",
      `
        <section class="content-grid content-grid-main">
          <div class="panel-card">
            <p class="eyebrow">실전 모드</p>
            <h2>모의고사 set 선택</h2>
            <div class="stack-column">
              ${mockExams.map((exam) => {
                const result = progress.mockExamHistory.find((item) => item.examId === exam.id);
                return `<button class="lesson-list-item ${exam.id === selectedMockExam?.id ? "is-active" : ""}" data-action="select-mock-exam" data-mock-exam-id="${exam.id}">
                  <strong>${exam.title}</strong>
                  <span>${exam.questionIds.length}문항 / ${exam.durationMinutes}분 · ${result ? `최근 ${result.score}점` : "미응시"}</span>
                </button>`;
              }).join("")}
            </div>
            <button class="action-button" data-action="start-mock-exam" data-mock-exam-id="${selectedMockExam?.id || ""}">${selectedMockExam?.title || "모의고사"} 시작</button>
          </div>
          <aside class="summary-card">
            <h3>최근 결과</h3>
            ${
              latestResult
                ? `
                  <strong>${latestResult.score}점</strong>
                  <p>${latestResult.correctCount}/${latestResult.totalQuestions} 정답</p>
                  <div class="subject-accuracy-grid">${renderExamSubjectSummary(data, latestResult.subjectScores)}</div>
                `
                : "<p>아직 제출한 모의고사 결과가 없습니다.</p>"
            }
            ${
              hasPendingMockExamWrongAnswers(progress)
                ? `<button class="ghost-action-button full-width" data-action="open-mock-wrong-note">모의고사 오답 복습</button>`
                : ""
            }
          </aside>
        </section>
      `
    );
  }

  const elapsedMinutes = Math.floor((Date.now() - activeExam.startedAt) / 60000);
  const remaining = Math.max(activeExam.durationMinutes - elapsedMinutes, 0);
  const answeredCount = Object.keys(activeExam.answers).length;

  return layout(
    "모의고사 진행 중",
    "mock-exam",
    `
      <section class="exam-top-grid">
        <div><strong>${activeExam.questions.length}</strong><span>전체 문항</span></div>
        <div><strong>${answeredCount}</strong><span>응답 완료</span></div>
        <div><strong>${remaining}분</strong><span>남은 시간</span></div>
        <div><strong>${activeExam.title}</strong><span>시험명</span></div>
      </section>

      <section class="content-grid content-grid-main">
        <div class="stack-column">
          ${activeExam.questions
            .map(
              (question, index) => `
                <article class="panel-card question-block">
                   <p class="eyebrow">${index + 1} / ${activeExam.questions.length}</p>
                   <h3>${question.question}</h3>
                   ${renderQuestionImages(question)}
                   <div class="choice-list">
                    ${question.choices
                      .map(
                        (choice) => `
                          <label class="choice-item">
                            <input
                              type="radio"
                              name="exam-${question.id}"
                              value="${choice.number}"
                              ${activeExam.answers[question.id] === choice.number ? "checked" : ""}
                              data-action="select-exam-answer"
                              data-question-id="${question.id}"
                            >
                            <span>${choice.number}. ${choice.text}</span>
                          </label>
                        `
                      )
                      .join("")}
                  </div>
                </article>
              `
            )
            .join("")}
          <button class="action-button full-width" data-action="submit-mock-exam">모의고사 제출</button>
        </div>

        <aside class="stack-column">
          <section class="summary-card">
            <h3>응시 진행률</h3>
            <div class="progress-track">
              <span style="width:${activeExam.questions.length ? (answeredCount / activeExam.questions.length) * 100 : 0}%"></span>
            </div>
            <p>${answeredCount}/${activeExam.questions.length} 문항 응답</p>
          </section>
        </aside>
      </section>
    `
  );
}

function renderSettings(data, progress) {
  const planSummary = buildStudyPlanSummary(data, progress);
  const studyPlanOptions = getStudyPlanOptions();
  const cloud = getCloudAuthState();
  const cloudUser = cloud.user?.email || "로그인하지 않음";

  return layout(
    "설정",
    "settings",
    `
      <section class="content-grid content-grid-main">
        <div class="stack-column">
          <!-- cloud sync settings removed -->
          <section class="panel-card" hidden>
            <div class="section-head">
              <div>
                <p class="eyebrow">클라우드 동기화</p>
                <h2>Firebase 학습 기록</h2>
              </div>
              <span class="status-badge">${cloud.configured ? cloudUser : "설정 필요"}</span>
            </div>
            ${cloud.user ? `
              <p>로그인한 계정의 학습 기록을 Firebase에 저장합니다.</p>
              <button class="ghost-action-button" data-action="cloud-sign-out">로그아웃</button>
            ` : `
              <p>${cloud.configured ? "로그인하면 여러 기기에서 학습 기록을 이어갈 수 있습니다." : "Firebase 설정이 필요합니다."}</p>
              <div class="form-grid">
                <label><span>이메일</span><input type="email" data-cloud-email autocomplete="email"></label>
                <label><span>비밀번호</span><input type="password" data-cloud-password autocomplete="current-password"></label>
              </div>
              <div class="inline-actions">
                <button class="action-button" data-action="cloud-sign-in" ${cloud.configured ? "" : "disabled"}>로그인</button>
                <button class="ghost-action-button" data-action="cloud-sign-up" ${cloud.configured ? "" : "disabled"}>회원가입</button>
              </div>
            `}
          </section>
          <section class="panel-card">
            <div class="section-head">
              <div>
                <p class="eyebrow">학습 데이터</p>
                <h2>학습 기록 관리</h2>
              </div>
            </div>
            <p>초기화하면 진도, 오답, 복습 큐, 북마크, 모의고사 기록이 모두 삭제됩니다.</p>
            <div class="inline-actions">
              <button class="danger-action-button" data-action="reset-progress">학습 기록 초기화</button>
              <button class="ghost-action-button" data-action="reload-app">새로고침</button>
            </div>
          </section>

          <section class="panel-card">
            <div class="section-head">
              <div>
                <p class="eyebrow">학습 플랜</p>
                <h2>30일 / 60일 설정</h2>
              </div>
            </div>
            <label>
              <span>플랜 선택</span>
              <select data-action="select-study-plan">
                ${studyPlanOptions
                  .map(
                    (option) => `
                      <option value="${option.durationDays}" ${option.durationDays === planSummary.durationDays ? "selected" : ""}>${option.label}</option>
                    `
                  )
                  .join("")}
              </select>
            </label>
            <p>총 기출 문제 수는 학습 기간과 무관하게 동일합니다. 달라지는 것은 하루 권장 기출 수와 lesson pace입니다.</p>
            <div class="summary-stats">
              <div><strong>${planSummary.totalQuestions}</strong><span>총 기출</span></div>
              <div><strong>${planSummary.dailyQuestions}</strong><span>하루 권장 기출</span></div>
              <div><strong>${planSummary.weeklyLessons}</strong><span>주간 lesson</span></div>
            </div>
            <p class="helper-text">오답 규칙: ${planSummary.wrongNoteRule}</p>
            <p class="helper-text">모의고사 규칙: ${planSummary.mockExamRule}</p>
          </section>

        </div>

        <aside class="summary-card">
          <h3>저장 위치</h3>
          <code>Firestore: users/{사용자UID}/progress/app</code>
        </aside>
      </section>
    `
  );
}

function renderDueQuestionReviewCards(data, dueItems) {
  return dueItems
    .map((item) => {
      const question = data.questions.find((entry) => entry.id === item.itemId);
      if (!question) {
        return "";
      }

      return `
        <article class="route-card">
          <div>
            <p class="route-day">${findSubjectName(data.subjects, item.subjectId)}</p>
            <h3>${question.question}</h3>
            <p class="route-goal">복습 사유: ${item.reason} / 예정 시각 ${formatDateTime(item.dueAt)}</p>
          </div>
          <div class="inline-actions">
            <button class="action-button" data-action="start-due-review">바로 풀기</button>
            <button class="ghost-action-button" data-action="toggle-bookmark" data-question-id="${item.itemId}">북마크</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderWrongNote(data, progress, state) {
  const subjectScope = state.wrongNoteScope !== "mock-exam";
  const activeScope = subjectScope ? "subject" : "mock-exam";
  const selectedSubjectId = getSelectedSubjectId(data, progress, state.wrongNoteSubjectId || state.selectedSubjectId);
  const unlockedSubjectIds = getUnlockedSubjectIds(data, progress);
  const dueItems = getDueQuestionReviewItems(progress, {
    subjectId: activeScope === "subject" ? selectedSubjectId : null,
    sourceType: activeScope === "mock-exam" ? MOCK_EXAM_SOURCE : null
  });
  const mixedReviewItems = buildMixedReviewItems(data, progress, {
    subjectId: activeScope === "subject" ? selectedSubjectId : null,
    sourceType: activeScope === "mock-exam" ? MOCK_EXAM_SOURCE : null
  });
  const wrongItems =
    activeScope === "mock-exam"
      ? getPendingWrongAnswers(progress, { sourceType: MOCK_EXAM_SOURCE })
      : getPendingWrongAnswers(progress, { subjectId: selectedSubjectId, sourceType: SUBJECT_QUIZ_SOURCE });

  return layout(
    activeScope === "mock-exam" ? "모의고사 복습 학습" : "복습 학습",
    "wrong-note",
    `
      <section class="controls-card ${activeScope === "subject" ? "" : "single-control"}">
        ${
          activeScope === "subject"
            ? `
              <label>
                <span>과목 선택</span>
                <select data-action="filter-wrong-note">
                  ${unlockedSubjectIds
                    .map(
                      (subjectId) => `
                        <option value="${subjectId}" ${subjectId === selectedSubjectId ? "selected" : ""}>${findSubjectName(data.subjects, subjectId)}</option>
                      `
                    )
                    .join("")}
                </select>
              </label>
            `
            : ""
        }
      </section>

      <section class="metric-grid">
        <article class="metric-box"><span>오늘 due</span><strong>${dueItems.length}</strong><p>지금 바로 풀 기출</p></article>
        <article class="metric-box"><span>누적 오답</span><strong>${wrongItems.length}</strong><p>아직 정리되지 않은 오답</p></article>
        <article class="metric-box"><span>복습 규칙</span><strong>1·3·7일</strong><p>오답 우선 간격 복습</p></article>
        <article class="metric-box"><span>학습 범위</span><strong>기출 전용</strong><p>복습 학습은 기출로만 구성</p></article>
      </section>

      <section class="content-grid content-grid-main">
        <section class="panel-card">
          <div class="section-head">
            <div>
              <p class="eyebrow">오늘 due</p>
              <h2>${activeScope === "mock-exam" ? "모의고사 기출 복습 큐" : `${findSubjectName(data.subjects, selectedSubjectId)} 기출 복습 큐`}</h2>
            </div>
          </div>
          <p class="helper-text">오늘 due 기출과 밀린 복습을 먼저 처리합니다.</p>
          ${renderDueQuestionReviewCards(data, dueItems) || "<div class='empty-panel'>현재 due 기출 복습 문항이 없습니다.</div>"}
        </section>

        <aside class="stack-column">
          <section class="summary-card">
            <h3>왜 다시 나왔나</h3>
            ${
              dueItems.length
                ? dueItems
                    .slice(0, 3)
                    .map(
                      (item, index) => `
                        <div class="history-row">
                          <div>
                            <strong>${index + 1}. ${findSubjectName(data.subjects, item.subjectId)}</strong>
                            <p>${item.reason === "wrong" ? "오답 우선" : "간격 복습"} / ${formatDateTime(item.dueAt)}</p>
                          </div>
                        </div>
                      `
                    )
                    .join("")
                : "<p>추천할 due 기출이 없습니다.</p>"
            }
          </section>
          <section class="summary-card">
            <h3>복습 규칙</h3>
            <p>오답 기출은 다음날, 3일 뒤, 7일 뒤 중심으로 다시 노출됩니다.</p>
            <p class="helper-text">정답 기출도 간격 복습 큐에 다시 들어가지만, 암기 복습은 별도 큐에 포함하지 않습니다.</p>
          </section>
        </aside>
      </section>

      <section class="panel-card">
        <div class="section-head">
          <div>
            <p class="eyebrow">누적 오답 기록</p>
            <h2>${activeScope === "mock-exam" ? "모의고사 오답 기록" : "과목 오답 기록"}</h2>
          </div>
        </div>
        ${
          wrongItems.length
            ? wrongItems
                .map((item) => {
                  const question = data.questions.find((entry) => entry.id === item.questionId);
                  if (!question) {
                    return "";
                  }

                  return `
                    <article class="route-card">
                      <div>
                        <p class="route-day">${findSubjectName(data.subjects, item.subjectId)}</p>
                        <h3>${question.question}</h3>
                        <p class="route-goal">오답 ${item.wrongCount}회 / 최근 오답 ${formatDateTime(item.lastWrongAt)}</p>
                      </div>
                      <div class="inline-actions">
                        <button
                          class="action-button"
                          data-action="review-wrong-answer"
                          data-question-id="${item.questionId}"
                          data-subject-id="${item.subjectId}"
                          data-source-type="${item.sourceType}"
                          data-source-id="${item.sourceId}"
                          data-lesson-id="${item.lessonId || ""}"
                        >
                          바로 풀기
                        </button>
                        <button class="ghost-action-button" data-action="toggle-bookmark" data-question-id="${item.questionId}">북마크</button>
                      </div>
                    </article>
                  `;
                })
                .join("")
            : "<div class='empty-panel'>현재 범위에서 정리할 오답이 없습니다.</div>"
        }
      </section>
    `
  );
}

function renderQuiz(data, progress, state) {
  const selectedSubjectId = getSelectedSubjectId(data, progress, state.selectedSubjectId);
  const questionPool = getQuestionPool(data, state, selectedSubjectId);

  if (!questionPool.length) {
    return layout(
      "기출 문제 풀이",
      "quiz",
      `
        <section class="empty-panel">
          <strong>표시할 기출 문제가 없습니다.</strong>
          <p>현재 과목 또는 현재 세션에 연결된 기출 문제가 없습니다.</p>
        </section>
      `
    );
  }

  const activeQuestion = questionPool.find((question) => question.id === state.selectedQuestionId) || questionPool[0];
  const result = state.quizResult;
  const solvedEntry = progress.solvedQuestions[activeQuestion.id];
  const sessionMode = state.quizSession?.mode || "free";
  const sessionLabel =
    sessionMode === "lesson-quiz"
      ? "신규 기출 문제 풀이"
      : sessionMode === "review-queue"
        ? "기출 복습 문제 풀이"
        : sessionMode === "wrong-note"
          ? "오답노트 기출 풀이"
          : "자유 기출 풀이";
  const sessionDescription =
    sessionMode === "lesson-quiz"
      ? "현재 lesson과 연결된 기출을 순서대로 풉니다."
      : sessionMode === "review-queue"
        ? "오늘 due 된 기출 복습 문항을 우선 처리합니다."
        : sessionMode === "wrong-note"
          ? "누적 오답 기록에서 다시 확인해야 할 기출입니다."
          : "선택한 과목의 기출을 자유롭게 확인합니다.";
  const queueSize = state.quizSession?.questionIds?.length || 1;
  const nextReviewLabel = result ? (result.isCorrect ? "정답 처리: 다음 간격 복습으로 이동" : "오답 처리: 빠른 복습 큐로 이동") : "";

  return layout(
    "기출 문제 풀이",
    "quiz",
    `
      <section class="metric-grid">
        <article class="metric-box"><span>현재 진행</span><strong>1 / ${queueSize}</strong><p>${sessionLabel}</p></article>
        <article class="metric-box"><span>오늘 due 잔량</span><strong>${buildReviewCounts(progress).totalDueCount}</strong><p>기출 복습 대기 문항</p></article>
        <article class="metric-box"><span>풀이 유형</span><strong>${sessionMode === "review-queue" ? "복습" : sessionMode === "wrong-note" ? "오답" : "신규"}</strong><p>${sessionDescription}</p></article>
        <article class="metric-box"><span>예상 소요</span><strong>${Math.max(3, queueSize * 2)}분</strong><p>현재 세션 기준</p></article>
      </section>

      <section class="content-grid content-grid-main">
        <div class="stack-column">
          <section class="controls-card double-controls">
            <label>
              <span>과목 선택</span>
              <select data-action="select-quiz-subject" ${state.quizSession ? "disabled" : ""}>
                ${getUnlockedSubjectIds(data, progress)
                  .map(
                    (subjectId) => `
                      <option value="${subjectId}" ${subjectId === selectedSubjectId ? "selected" : ""}>${findSubjectName(data.subjects, subjectId)}</option>
                    `
                  )
                  .join("")}
              </select>
            </label>
            <label>
              <span>문제 선택</span>
              <select data-action="select-question">
                ${questionPool
                  .map(
                    (question) => `
                      <option value="${question.id}" ${question.id === activeQuestion.id ? "selected" : ""}>${question.source.questionNumber}번 - ${question.id}</option>
                    `
                  )
                  .join("")}
              </select>
            </label>
          </section>

          <article class="question-panel">
            <div class="question-meta-row">
              <span class="eyebrow">${activeQuestion.source.examDate}</span>
              <span class="status-pill">${activeQuestion.source.questionNumber}번</span>
            </div>
            <h2>${activeQuestion.question}</h2>
            <div class="tag-list">
              ${activeQuestion.tags.map((tag) => `<span class="tag-chip">${tag}</span>`).join("")}
            </div>
            <div class="choice-list">
              ${activeQuestion.choices
                .map(
                  (choice) => `
                    <label class="choice-item">
                      <input type="radio" name="question-choice" value="${choice.number}">
                      <span>${choice.number}. ${choice.text}</span>
                    </label>
                  `
                )
                .join("")}
            </div>
            <div class="inline-actions">
              <button class="action-button" data-action="submit-question" data-question-id="${activeQuestion.id}">채점하기</button>
              ${result && state.quizSession ? `<button class="ghost-action-button" data-action="advance-quiz" data-question-id="${activeQuestion.id}">${getQuizAdvanceLabel(state)}</button>` : ""}
            </div>
            ${
              result
                ? `
                  <section class="feedback-panel ${result.isCorrect ? "is-correct" : "is-wrong"}">
                    <strong>${result.isCorrect ? "정답입니다." : `오답입니다. 정답은 ${result.correctChoice}번입니다.`}</strong>
                    <p>${result.explanation}</p>
                    <div class="tag-list">
                      <span class="status-pill ${result.isCorrect ? "is-success" : ""}">${nextReviewLabel}</span>
                    </div>
                  </section>
                `
                : ""
            }
          </article>
        </div>

        <aside class="stack-column">
          <section class="summary-card">
            <h3>문제 정보</h3>
            <div class="meta-list">
              <span>과목</span><strong>${findSubjectName(data.subjects, activeQuestion.subjectId)}</strong>
              <span>출제일</span><strong>${activeQuestion.source.examDate}</strong>
              <span>이전 시도</span><strong>${solvedEntry?.attempts || 0}</strong>
              <span>북마크</span><strong>${progress.bookmarks.includes(activeQuestion.id) ? "저장됨" : "미저장"}</strong>
            </div>
            <button class="ghost-action-button full-width" data-action="toggle-bookmark" data-question-id="${activeQuestion.id}">
              ${progress.bookmarks.includes(activeQuestion.id) ? "북마크 해제" : "북마크 추가"}
            </button>
          </section>
          <section class="summary-card">
            <h3>해설 요약</h3>
            <p>${activeQuestion.explanation}</p>
          </section>
          <section class="summary-card">
            <h3>다시 나오는 이유</h3>
            <p>${
              sessionMode === "review-queue"
                ? "오늘 due 기출 복습 문항입니다."
                : sessionMode === "wrong-note"
                  ? "오답노트에서 다시 확인해야 하는 기출입니다."
                  : "현재 학습 흐름과 연결된 기출입니다."
            }</p>
            <p class="helper-text">정답 여부와 오답 횟수, 복습 간격에 따라 다시 노출됩니다.</p>
          </section>
        </aside>
      </section>
    `,
    sessionMode === "lesson-quiz"
      ? "현재 lesson의 기출을 모두 풀면 다음 lesson 또는 과목 오답노트로 이동합니다."
      : sessionMode === "review-queue"
        ? "채점 후 다음 문제 버튼으로 due 복습을 계속 진행합니다."
        : sessionMode === "wrong-note"
          ? "정답 처리되면 해당 오답 기록이 정리되고 다음 복습 단계로 넘어갑니다."
          : ""
  );
}

function renderProgress(data, progress) {
  const stats = computeStats(data, progress);
  const subjectAccuracies = computeSubjectAccuracyRows(data, progress);
  const currentSubject = getCurrentSubject(data, progress);
  const planSummary = buildStudyPlanSummary(data, progress);

  return layout(
    "학습 현황",
    "progress",
    `
      <section class="metric-grid">
        <article class="metric-box"><span>개념 진도율</span><strong>${percent(stats.lessonProgress)}</strong><p>${stats.completedCount}/${data.lessons.length} lesson 완료</p></article>
        <article class="metric-box"><span>오늘 due 복습</span><strong>${stats.dueReviewCount}</strong><p>기출 복습 ${stats.dueQuestionCount}문항</p></article>
        <article class="metric-box"><span>정답률</span><strong>${percent(stats.accuracy)}</strong><p>${stats.correctCount}문제 정답</p></article>
        <article class="metric-box"><span>밀린 복습</span><strong>${stats.overdueReviewCount}</strong><p>우선 처리 필요</p></article>
      </section>

      <section class="panel-card">
        <div class="section-head">
          <div>
            <p class="eyebrow">현재 진행</p>
            <h2>${currentSubject ? currentSubject.name : "전체 진도 완료"}</h2>
          </div>
        </div>
        <p>${currentSubject ? "현재 과목의 신규 lesson과 오늘 due 된 기출 복습을 병행 중입니다." : "현재는 모의고사와 누적 복습 중심 단계입니다."}</p>
      </section>

      <section class="panel-card">
        ${subjectProgressRows(data, progress)}
      </section>

      <section class="panel-card">
        <div class="section-head">
          <div>
            <p class="eyebrow">플랜 요약</p>
            <h2>${planSummary.label}</h2>
          </div>
        </div>
        <div class="subject-accuracy-grid">
          <article class="subject-score-card"><strong>총 기출 목표</strong><p>${planSummary.totalQuestions}</p><span>30일·60일 동일 총량</span></article>
          <article class="subject-score-card"><strong>오늘 신규 권장</strong><p>${planSummary.recommendedNewQuestions}</p><span>복습량 반영</span></article>
          <article class="subject-score-card"><strong>오늘 복습 물량</strong><p>${planSummary.dueReviewCount}</p><span>기출 복습 기준</span></article>
          <article class="subject-score-card"><strong>주간 lesson pace</strong><p>${planSummary.weeklyLessons}</p><span>${planSummary.daysPerLesson}일에 1개 pace</span></article>
        </div>
      </section>

      <section class="panel-card">
        <div class="section-head">
          <div>
            <p class="eyebrow">과목별 정답률</p>
            <h2>취약 구간 비교</h2>
          </div>
        </div>
        <div class="subject-accuracy-grid">
          ${subjectAccuracies
            .map(
              (item) => `
                <article class="subject-score-card">
                  <strong>${findSubjectName(data.subjects, item.subjectId)}</strong>
                  <p>${percent(item.ratio)}</p>
                  <div class="progress-track"><span style="width:${item.ratio}%"></span></div>
                  <span>${item.correct}/${item.total} 정답</span>
                </article>
              `
            )
            .join("")}
        </div>
      </section>

      <section class="content-grid content-grid-main">
        <section class="panel-card">
          <div class="section-head">
            <div>
              <p class="eyebrow">모의고사 기록</p>
              <h3>최근 제출 결과</h3>
            </div>
          </div>
          ${
            progress.mockExamHistory.length
              ? progress.mockExamHistory
                  .map(
                    (result) => `
                      <div class="history-row">
                        <div>
                          <strong>${result.examId}</strong>
                          <p>${formatDateTime(result.submittedAt)}</p>
                        </div>
                        <strong>${result.score}점 / ${result.correctCount}/${result.totalQuestions}</strong>
                      </div>
                    `
                  )
                  .join("")
              : "<div class='empty-panel'>아직 제출한 모의고사 결과가 없습니다.</div>"
          }
        </section>

        <aside class="stack-column">
          <section class="summary-card">
            <h3>마지막 학습</h3>
            <p>${formatDateTime(stats.lastStudyDate)}</p>
          </section>
          <section class="summary-card">
            <h3>모의고사 가능</h3>
            <p>${canStartMockExam(data, progress) ? "가능" : "잠금"}</p>
          </section>
        </aside>
      </section>
    `
  );
}

function navItems() {
  return [
    ["home", "대시보드"],
    ["concept", "개념 학습"],
    ["memorization", "암기 학습"],
    ["wrong-note", "복습 학습"],
    ["mock-exam", "모의고사"],
    ["progress", "학습 현황"],
    ["settings", "설정"]
  ];
}

function renderAuthGate(state) {
  const error = state.authError
    ? `<div class="auth-error" role="alert">${escapeHtml(state.authError)}</div>`
    : "";

  return `
    <main class="auth-gate">
      <section class="auth-card" aria-labelledby="auth-title">
        <p class="auth-kicker">JT Academy</p>
        <h1 id="auth-title">학습을 시작하려면 로그인하세요</h1>
        <p class="auth-description">로그인하면 여러 기기에서 학습 진행도와 오답 기록을 이어갈 수 있습니다.</p>
        ${error}
        <form class="auth-form" data-auth-form>
          <label>
            <span>이메일</span>
            <input type="email" data-auth-email autocomplete="email" required placeholder="you@example.com">
          </label>
          <label>
            <span>비밀번호</span>
            <input type="password" data-auth-password autocomplete="current-password" minlength="6" required placeholder="6자 이상">
          </label>
          <div class="auth-actions">
            <button class="stitch-primary-button" type="button" data-action="auth-sign-in">로그인</button>
            <button class="stitch-secondary-button" type="button" data-action="auth-sign-up">회원가입</button>
          </div>
        </form>
        <button class="auth-back-button" type="button" data-action="dismiss-auth-gate">학습 화면으로 돌아가기</button>
        <p class="auth-helper">처음 이용하시면 회원가입을 눌러 계정을 만드세요.</p>
      </section>
    </main>
  `;
}

const AUTH_REQUIRED_ACTIONS = new Set([
  "start-due-review",
  "start-daily-learning",
  "start-next-daily-learning",
  "start-next-daily-review",
  "complete-lesson",
  "submit-question",
  "advance-quiz",
  "toggle-bookmark",
  "submit-memorization",
  "advance-memorization",
  "start-mock-exam",
  "submit-mock-exam",
  "review-wrong-answer",
  "select-study-plan",
  "reset-progress"
]);

function markAuthRequiredActions(root) {
  root.querySelectorAll("[data-action]").forEach((element) => {
    if (!AUTH_REQUIRED_ACTIONS.has(element.dataset.action)) {
      return;
    }
    element.classList.add("is-auth-locked");
    element.setAttribute("aria-disabled", "true");
    element.title = "로그인 후 사용할 수 있습니다.";
  });
}

function renderAuthNotice() {
  return `
    <div class="auth-notice" role="alert">
      <span>로그인을 해 주세요.</span>
      <button type="button" data-action="dismiss-auth-notice" aria-label="로그인 안내 닫기">×</button>
    </div>
  `;
}

function layout(title, activeRoute, body, meta = "") {
  return `
    <div class="stitch-shell route-${activeRoute}">
      <aside class="stitch-sidebar">
        <div class="stitch-sidebar-brand">
          <p class="stitch-brand-kicker">JT Academy</p>
          <h1>소방설비기사</h1>
          <p class="stitch-brand-copy">전기 분야 학습 대시보드</p>
        </div>
        <nav class="stitch-sidebar-nav">
          ${stitchNavItems()
            .map(
              ([route, label]) => `
                <button class="stitch-nav-item ${activeRoute === route ? "is-active" : ""}" data-route="${route}">
                  <span class="stitch-nav-dot"></span>
                  <span>${label}</span>
                </button>
              `
            )
            .join("")}
        </nav>
        <div class="stitch-sidebar-footer">
          <p>학습 기록은 로그인한 Firebase 계정에 저장됩니다.</p>
        </div>
      </aside>
      <div class="stitch-main">
        <header class="stitch-topbar">
          <div>
            <p class="stitch-page-kicker">Study Workspace</p>
            <h2>${title}</h2>
          </div>
          <div class="stitch-topbar-actions">
            <div class="stitch-search-shell">
              <span>학습 흐름 중심 UI</span>
            </div>
            <button class="stitch-icon-button" type="button" aria-label="알림">알림</button>
          </div>
        </header>
        <div class="stitch-page-frame">
          ${meta ? `<section class="stitch-meta-banner">${meta}</section>` : ""}
          <main class="stitch-page-content">${body}</main>
        </div>
      </div>
    </div>
  `;
}

function renderStitchHome(data, progress) {
  const stats = computeStats(data, progress);
  const currentSubject = getCurrentSubject(data, progress);
  const nextLesson = currentSubject ? getNextLessonInSubject(data, progress, currentSubject.id) : null;
  const planSummary = buildStudyPlanSummary(data, progress);
  const hasDueReviews = planSummary.dueReviewCount > 0;
  const dueItems = getDueQuestionReviewItems(progress).slice(0, 3);
  const routeCards = data.subjects
    .map((subject) => {
      const summary = getSubjectProgressSummary(data, progress, subject.id);
      const upcomingLesson = getNextLessonInSubject(data, progress, subject.id) || getLessonsBySubject(data, subject.id)[0];

      return `
        <article class="stitch-feature-card">
          <div class="stitch-feature-icon">${summary.completedLessons}/${summary.lessonCount}</div>
          <div class="stitch-feature-body">
            <p class="stitch-card-label">${subject.name}</p>
            <h3>${upcomingLesson?.title || "학습 완료"}</h3>
            <p>${subject.description || "과목 학습 흐름을 이어갈 수 있습니다."}</p>
            <div class="stitch-inline-meta">
              <span>오답 ${summary.pendingWrongCount}건</span>
              <span>완료 lesson ${summary.completedLessons}개</span>
            </div>
          </div>
          <button class="stitch-secondary-button" data-route="concept" data-subject-id="${subject.id}">이어서 학습</button>
        </article>
      `;
    })
    .join("");
  const duePreview = dueItems.length
    ? dueItems
        .map((item) => `
          <div class="stitch-list-row">
            <div>
              <strong>${findSubjectName(data.subjects, item.subjectId)}</strong>
              <p>${item.reason === "wrong" ? "오답 정리" : "간격 복습"} · ${formatDateTime(item.dueAt)}</p>
            </div>
            <button class="stitch-chip-button" data-action="start-due-review">바로 풀기</button>
          </div>
        `)
        .join("")
    : `<div class="stitch-empty-card"><strong>오늘 처리할 복습이 없습니다.</strong><p>신규 학습이나 모의고사를 진행해도 됩니다.</p></div>`;

  return stitchLayout(
    "소방설비기사(전기)",
    "home",
    `
      <section class="stitch-hero-card">
        <div class="stitch-hero-copy">
          <div class="stitch-badge">현재 학습 중</div>
          <h3>${currentSubject ? currentSubject.name : "전체 학습 완료"}</h3>
          <p>${
            nextLesson
              ? `다음 lesson은 "${nextLesson.title}"입니다. 신규 학습과 오늘 due 복습을 함께 처리하는 흐름으로 구성했습니다.`
              : "모든 신규 lesson을 완료했습니다. 이제 복습, 오답 정리, 모의고사 중심으로 이어가면 됩니다."
          }</p>
          <div class="stitch-hero-actions">
            <button class="stitch-primary-button" data-route="concept" data-subject-id="${currentSubject?.id || data.subjects[0]?.id || ""}">학습 시작</button>
            <button class="stitch-secondary-button" data-action="start-due-review" ${hasDueReviews ? "" : "disabled"}>복습 시작</button>
          </div>
        </div>
        <div class="stitch-hero-mark">
          <strong>${percent(stats.accuracy)}</strong>
          <span>현재 정답률</span>
        </div>
      </section>

      <section class="stitch-kpi-grid">
        <article class="stitch-kpi-card">
          <span>개념 완료</span>
          <strong>${stats.completedCount}</strong>
          <p>${data.lessons.length}개 lesson 중 완료 수</p>
        </article>
        <article class="stitch-kpi-card">
          <span>오늘 복습</span>
          <strong>${stats.dueReviewCount}</strong>
          <p>지금 바로 처리할 due 항목</p>
        </article>
        <article class="stitch-kpi-card">
          <span>신규 기출 권장</span>
          <strong>${planSummary.recommendedNewQuestions}</strong>
          <p>${planSummary.label} 기준 자동 조정</p>
        </article>
        <article class="stitch-kpi-card is-urgent">
          <span>바로 복습</span>
          <strong>${stats.overdueReviewCount}</strong>
          <p>우선 처리 필요한 overdue 수</p>
        </article>
      </section>

      <section class="stitch-dashboard-grid">
        <section class="stitch-surface-card">
          <div class="stitch-section-head">
            <div>
              <p class="stitch-card-label">오늘의 신규 학습</p>
              <h3>${currentSubject ? currentSubject.name : "전체 과목"}</h3>
            </div>
            <span class="stitch-pill">${planSummary.totalQuestions}문항 목표</span>
          </div>
          <p class="stitch-card-copy">${nextLesson ? `다음 lesson: ${nextLesson.title}` : "현재 이어서 학습할 신규 lesson이 없습니다."}</p>
          <div class="stitch-feature-stack">
            ${routeCards}
          </div>
        </section>

        <aside class="stitch-side-stack">
          <section class="stitch-surface-card">
            <div class="stitch-section-head">
              <div>
                <p class="stitch-card-label">오늘의 복습</p>
                <h3>${planSummary.dueReviewCount}건 due</h3>
              </div>
            </div>
            <p class="stitch-card-copy">기출 복습 ${planSummary.dueQuestionCount}문항, overdue ${planSummary.overdueReviewCount}문항을 우선 처리합니다.</p>
            <div class="stitch-stack-actions">
              <button class="stitch-primary-button" data-action="start-due-review" ${hasDueReviews ? "" : "disabled"}>바로 풀기</button>
              <button class="stitch-secondary-button" data-route="wrong-note">복습 상세 보기</button>
            </div>
          </section>
          <section class="stitch-surface-card">
            <div class="stitch-section-head">
              <div>
                <p class="stitch-card-label">학습 계획</p>
                <h3>${planSummary.label}</h3>
              </div>
            </div>
            <p class="stitch-card-copy">주간 pace ${planSummary.weeklyLessons}, 추천 신규 ${planSummary.recommendedNewQuestions}, 저장 위치 Firebase</p>
          </section>
        </aside>
      </section>

      <section class="stitch-surface-card">
        <div class="stitch-section-head">
          <div>
            <p class="stitch-card-label">복습 대기</p>
            <h3>오늘 다시 볼 항목</h3>
          </div>
        </div>
        <div class="stitch-list-stack">
          ${duePreview}
        </div>
      </section>
    `
  );
}

function renderStageOneLayout(body, hasDueReviews, sidebarAction = {}) {
  const cloud = getCloudAuthState();
  const user = cloud.user;
  const userLabel = user?.displayName?.trim() || user?.email?.split("@")[0] || "회원";
  const accountControl = user
    ? `<div class="stage1-account-control">
        <span class="stage1-account-user" title="${escapeHtml(user.email || "")}">
          <span class="stage1-account-icon" aria-hidden="true">⌂</span>
          <span>${escapeHtml(userLabel)} 님</span>
        </span>
        <button class="stage1-account-logout" type="button" data-action="cloud-sign-out">로그아웃</button>
      </div>`
    : cloud.configured
      ? `<button class="stage1-account-user is-guest stage1-account-login" type="button" data-action="open-auth-gate"><span class="stage1-account-icon" aria-hidden="true">⌂</span><span>로그인 필요</span></button>`
      : `<span class="stage1-account-user is-guest"><span class="stage1-account-icon" aria-hidden="true">⌂</span><span>게스트 모드</span></span>`;
  const menuItems = stitchNavItems().map(([route, label], index) => [
    ["⌂", "▣", "◇", "↻", "◇", "◒", "⚙"][index] || "•",
    route,
    label
  ]);

  return `
    <div class="stage1-shell">
      <aside class="stage1-sidebar">
        <div class="stage1-brand">
          <p>JT Academy</p>
          <strong>\uC18C\uBC29\uC124\uBE44\uAE30\uC0AC</strong>
          <span>\uC804\uAE30\uBD84\uC57C \uD559\uC2B5 \uC6CC\uD06C\uC2A4\uD398\uC774\uC2A4</span>
        </div>
        <nav class="stage1-sidebar-nav" aria-label="\uC8FC \uBA54\uB274">
          ${menuItems.map(([icon, route, label]) => `
            <button class="stage1-sidebar-item ${["mock-exam", "progress", "settings"].includes(route) ? "stage1-mobile-secondary" : ""} ${route === "home" ? "is-active" : ""}" data-route="${route}">
              <span class="stage1-sidebar-icon" aria-hidden="true">${icon}</span><span>${label}</span>
            </button>
          `).join("")}
        </nav>
        <details class="stage1-mobile-more">
          <summary>더보기</summary>
          <div class="stage1-mobile-more-menu">
            ${menuItems
              .filter(([, route]) => ["mock-exam", "progress", "settings"].includes(route))
              .map(([icon, route, label]) => `
                <button class="stage1-sidebar-item" data-route="${route}">
                  <span class="stage1-sidebar-icon" aria-hidden="true">${icon}</span><span>${label}</span>
                </button>
              `)
              .join("")}
          </div>
        </details>
        <div class="stage1-sidebar-bottom">
          <button class="stage1-primary full-width" ${sidebarAction.action ? `data-action="${sidebarAction.action}"` : ""} ${sidebarAction.disabled ? "disabled" : ""}>${sidebarAction.label || "학습 시작"}</button>
          <p>\uD559\uC2B5 \uAE30\uB85D\uC740 \uC774 \uBE0C\uB77C\uC6B0\uC800\uC5D0 \uC800\uC7A5\uB429\uB2C8\uB2E4.</p>
        </div>
      </aside>
      <div class="stage1-main">
        <header class="stage1-topbar">
          <div class="stage1-mobile-brand" aria-label="앱 명칭">
            <strong>JT Academy</strong>
            <span>소방설비기사(전기)</span>
          </div>
          <div class="stage1-mobile-dashboard-row">
            <nav aria-label="\uBCF4\uC870 \uBA54\uB274">
              <button class="is-active" data-route="home">\uD559\uC2B5 \uB300\uC2DC\uBCF4\uB4DC</button>
            </nav>
            <div class="stage1-topbar-tools"><span class="stage1-topbar-status">\uAC80\uC0C9\uC740 \uC900\uBE44 \uC911</span><button class="stage1-notification-button" type="button" aria-label="\uC54C\uB9BC">♢</button>${accountControl}</div>
          </div>
        </header>
        <main class="stage1-page-content">${body}</main>
      </div>
    </div>
  `;
}

function renderStageOneHome(data, progress) {
  const stats = computeStats(data, progress);
  const currentSubject = getCurrentSubject(data, progress);
  const nextLesson = currentSubject
    ? getNextLessonInSubject(data, progress, currentSubject.id)
    : null;
  const planSummary = buildStudyPlanSummary(data, progress);
  const dailyTarget = planSummary.dailyTarget;
  const dailyLessons = data.lessons.filter((lesson) => dailyTarget.contentIds.includes(lesson.id));
  const firstDailyLesson = dailyLessons.find((lesson) => !isLessonFullyComplete(progress, lesson)) || dailyLessons[0] || nextLesson;
  const dailySubjectNames = dailyTarget.subjectIds
    .map((subjectId) => data.subjects.find((subject) => subject.id === subjectId)?.name)
    .filter(Boolean)
    .join(", ");
  const todayProgressPercent = dailyTarget.totalTodayCount
    ? Math.min(100, Math.round((dailyTarget.completedTodayCount / dailyTarget.totalTodayCount) * 100))
    : 0;
  const learningComplete = dailyTarget.lessonCount + dailyTarget.questionCount > 0
    && dailyTarget.remainingLessonCount === 0
    && dailyTarget.remainingQuestionCount === 0;
  const scheduleProgress = planSummary.scheduleProgress;
  const scheduleProgressPercent = scheduleProgress?.percent || 0;
  const subjectProgress = data.subjects.map((subject) => {
    const summary = getSubjectProgressSummary(data, progress, subject.id);
    const total = Math.max(summary.lessonCount, 1);
    return { subject, percent: Math.round((summary.completedLessons / total) * 100) };
  });
  const weeklyBars = [58, 76, 92, 64, 82, 48, 30]
    .map((height, index) => `<span class="stage1-week-bar" style="--stage1-bar-height:${height}%"><i></i><small>${["월", "화", "수", "목", "금", "토", "일"][index]}</small></span>`)
    .join("");
  const lessonRows = (dailyLessons.length ? dailyLessons : nextLesson ? [nextLesson] : []).slice(0, 4).map((lesson) => `
    <button class="stage1-path-item" data-route="concept" data-subject-id="${lesson.subjectId}" data-lesson-id="${lesson.id}">
      <span class="stage1-path-dot"></span>
      <span>${lesson.title}</span>
      <b>${isLessonFullyComplete(progress, lesson) ? "완료" : "진행"}</b>
    </button>
  `).join("");
  const selectedReviewItems = buildMixedReviewItems(data, progress);
  const reviewSelectionCounts = {
    wrong: selectedReviewItems.filter((item) => item.reason === "wrong").length,
    frequent: selectedReviewItems.filter((item) => item.reason === "frequent").length,
    spaced: selectedReviewItems.filter((item) => item.reason !== "wrong" && item.reason !== "frequent").length
  };
  const hasDueReviews = selectedReviewItems.length > 0;
  const reviewComplete = !hasDueReviews;
  const dailyTargetComplete = dailyTarget.totalTodayCount > 0 && dailyTarget.remainingTodayCount === 0;
  const dayNo = dailyTarget.dayNo;
  const nextDayNo = Math.min(dayNo + 1, planSummary.durationDays);
  const learningActionButtons = learningComplete
    ? `
      <div class="stage1-action-stack">
        <button class="stage1-secondary full-width" type="button" disabled>${dayNo}일차 학습완료</button>
        ${dailyTargetComplete && dayNo < planSummary.durationDays
          ? `<button class="stage1-primary full-width" data-action="start-next-daily-learning">${nextDayNo}일차 학습 시작</button>`
          : ""}
      </div>
    `
    : `<button class="stage1-primary full-width" data-action="start-daily-learning">${dayNo}일차 학습 시작</button>`;
  const reviewActionButtons = reviewComplete
    ? `
      <div class="stage1-action-stack">
        <button class="stage1-secondary full-width" type="button" disabled>${dayNo}일차 복습완료</button>
        ${dailyTargetComplete && dayNo < planSummary.durationDays
          ? `<button class="stage1-primary full-width" data-action="start-next-daily-review">${nextDayNo}일차 복습 시작</button>`
          : ""}
      </div>
    `
    : `
      <div class="stage1-action-stack">
        <button class="stage1-primary full-width" data-route="wrong-note">${dayNo}일차 복습 시작</button>
        <button class="stage1-secondary full-width" data-route="wrong-note">복습 상세 보기</button>
      </div>
    `;
  const sidebarAction = learningComplete
    ? dailyTargetComplete && dayNo < planSummary.durationDays
      ? { label: `▶ ${nextDayNo}일차 학습 시작`, action: "start-next-daily-learning" }
      : { label: `${dayNo}일차 학습완료`, disabled: true }
    : { label: `▶ ${dayNo}일차 학습 시작`, action: "start-daily-learning" };
  const reviewAlertTitle = stats.overdueReviewCount > 0 ? "밀린 복습 우선 처리" : hasDueReviews ? "오늘 복습 처리" : "복습 대기 없음";
  const reviewAlertCopy = stats.overdueReviewCount > 0
    ? `${stats.overdueReviewCount}개 문항을 우선 처리하세요.`
    : hasDueReviews ? "오늘 예정된 복습 문항을 처리하세요." : "현재 처리할 복습 문항이 없습니다.";

  return renderStageOneLayout(`
    <div class="stage1-dashboard">
      <section class="stage1-kpis">
        <article class="stage1-kpi">
          <span>개념 완료</span>
          <div class="stage1-kpi-value"><strong>${stats.completedCount}</strong><small>/ ${data.lessons.length} lessons</small></div>
          <div class="stage1-meter"><i style="width:${percent(stats.lessonProgress)}"></i></div>
        </article>
        <article class="stage1-kpi">
          <span>오늘 복습</span>
          <div class="stage1-kpi-value"><strong>${stats.dueReviewCount}</strong><small>개 문항</small></div>
          <p>지금 바로 처리하세요.</p>
        </article>
        <article class="stage1-kpi">
          <span>정답률</span>
          <div class="stage1-kpi-value"><strong>${Math.round(stats.accuracy)}</strong><small>%</small></div>
          <p>누적 정답률</p>
        </article>
        <article class="stage1-kpi is-alert">
          <span>밀린 복습</span>
          <div class="stage1-kpi-value"><strong>${stats.overdueReviewCount}</strong><small>개 문항</small></div>
          <p>우선 처리가 필요합니다.</p>
        </article>
      </section>

      <div class="stage1-mockup-grid">
        <section class="stage1-card stage1-mockup-learning">
          <div class="stage1-card-heading"><div><span class="stage1-card-label">오늘의 학습</span><h3>${dailySubjectNames || currentSubject?.name || "전체 과목"}</h3></div><span class="stage1-icon">▣</span></div>
          <div class="stage1-next-lesson"><small>DAY ${dailyTarget.dayNo} TARGET</small><strong>${firstDailyLesson?.title || "학습 준비가 완료되었습니다."}</strong></div>
          <div class="stage1-mockup-stat"><span>오늘의 학습 문항</span><strong>${dailyTarget.questionCount}</strong><small>문항</small></div>
          <div class="stage1-card-heading stage1-subheading"><span class="stage1-card-label">lesson 미리보기</span><span>${dailyTarget.lessonCount}개 lesson</span></div>
          <div class="stage1-path-list">${lessonRows || `<div class="stage1-empty">오늘 학습할 lesson이 없습니다.</div>`}</div>
          ${learningActionButtons}
        </section>

        <section class="stage1-card stage1-mockup-review">
          <div class="stage1-card-heading"><div><span class="stage1-card-label">오늘의 복습 학습</span><h3>${selectedReviewItems.length}개 선정</h3></div><span class="stage1-icon">↻</span></div>
          <div class="stage1-review-split">
            <div><span>오늘 복습</span><strong>${selectedReviewItems.length}</strong><small>전체 대상</small></div>
            <div><span>오답</span><strong>${reviewSelectionCounts.wrong}</strong><small>우선 처리</small></div>
            <div><span>빈출 보강</span><strong>${reviewSelectionCounts.frequent}</strong><small>lesson 보강</small></div>
            <div><span>간격 복습</span><strong>${reviewSelectionCounts.spaced}</strong><small>정답 반복</small></div>
          </div>
          <div class="stage1-review-alert"><strong>${reviewAlertTitle}</strong><p>${reviewAlertCopy}</p></div>
          ${reviewActionButtons}
        </section>
      </div>

      <div class="stage1-home-support-grid">
        <section class="stage1-plan-card stage1-mockup-plan">
          <div class="stage1-card-heading"><h3>${planSummary.label}</h3><span class="stage1-plan-badge">${planSummary.durationDays}일</span></div>
          <div class="stage1-plan-rings">
            <div class="stage1-ring" style="--stage1-progress:${todayProgressPercent}%"><strong>${todayProgressPercent}%</strong><span>오늘 진행률</span></div>
            <div class="stage1-ring is-schedule" style="--stage1-progress:${scheduleProgressPercent}%"><strong>${scheduleProgressPercent}%</strong><span>전체 진행률</span></div>
          </div>
          <p>오늘 lesson ${dailyTarget.lessonCount}개와 기출 ${dailyTarget.questionCount}문항을 권장합니다.</p>
          <div class="stage1-plan-breakdown">
            <span>선정 일정 기준</span>
            <b>${scheduleProgress?.completedCount || 0}/${scheduleProgress?.totalCount || 0}</b>
          </div>
        </section>

        <section class="stage1-card stage1-weekly-card">
          <div class="stage1-card-heading"><div><span class="stage1-card-label">주간 학습 페이스</span><h3>${planSummary.weeklyLessons}개 lesson / 주</h3></div></div>
          <div class="stage1-week-bars">${weeklyBars}</div>
        </section>
      </div>

      <section class="stage1-card stage1-subject-card">
        <div class="stage1-card-heading"><div><span class="stage1-card-label">과목별 진도 현황</span><h3>과목별 학습 진행률</h3></div></div>
        <div class="stage1-subject-grid">
          ${subjectProgress.map(({ subject, percent: subjectPercent }) => `
            <div class="stage1-progress-row"><div><span>${subject.name}</span><b>${subjectPercent}%</b></div><div class="stage1-meter"><i style="width:${subjectPercent}%"></i></div></div>
          `).join("")}
        </div>
      </section>
    </div>
  `, hasDueReviews, sidebarAction);
}

function renderStitchWrongNote(data, progress, state) {
  const subjectScope = state.wrongNoteScope !== "mock-exam";
  const activeScope = subjectScope ? "subject" : "mock-exam";
  const selectedSubjectId = getSelectedSubjectId(data, progress, state.wrongNoteSubjectId || state.selectedSubjectId);
  const unlockedSubjectIds = getUnlockedSubjectIds(data, progress);
  const dueItems = getDueQuestionReviewItems(progress, {
    subjectId: activeScope === "subject" ? selectedSubjectId : null,
    sourceType: activeScope === "mock-exam" ? MOCK_EXAM_SOURCE : null
  });
  const mixedReviewItems = buildMixedReviewItems(data, progress, {
    subjectId: activeScope === "subject" ? selectedSubjectId : null,
    sourceType: activeScope === "mock-exam" ? MOCK_EXAM_SOURCE : null
  });
  const todayReviewedQueueIds = getTodayReviewedQueueIds(progress);
  const mixedQueueIds = new Set(mixedReviewItems.map((item) => item.queueId));
  const completedReviewItems = progress.reviewQueue.filter((item) =>
    item.itemType === "question"
    && !mixedQueueIds.has(item.queueId)
    && todayReviewedQueueIds.has(item.queueId)
    && (activeScope !== "subject" || !selectedSubjectId || item.subjectId === selectedSubjectId)
    && (activeScope !== "mock-exam" || item.sourceType === MOCK_EXAM_SOURCE)
  );
  const reviewItems = [...mixedReviewItems, ...completedReviewItems];
  const wrongItems =
    activeScope === "mock-exam"
      ? getPendingWrongAnswers(progress, { sourceType: MOCK_EXAM_SOURCE })
      : getPendingWrongAnswers(progress, { subjectId: selectedSubjectId, sourceType: SUBJECT_QUIZ_SOURCE });

  const dueCards = reviewItems.length
    ? reviewItems
        .map((item) => {
          const question = data.questions.find((entry) => entry.id === item.itemId);
          if (!question) {
            return "";
          }

          const completedToday = todayReviewedQueueIds.has(item.queueId);

          return `
            <article class="stitch-queue-card">
              <div class="stitch-queue-icon ${item.reason === "wrong" ? "is-danger" : ""}">${item.reason === "wrong" ? "!" : "R"}</div>
              <div class="stitch-queue-copy">
                <div class="stitch-inline-meta">
                  <span>${findSubjectName(data.subjects, item.subjectId)}</span>
                  <span>${item.reason === "wrong" ? "오답 우선" : item.reason === "frequent" ? "빈출 반복" : "간격 복습"}</span>
                </div>
                <h3>${question.question}</h3>
                <p>${completedToday ? "오늘 복습을 완료한 문항입니다." : item.reason === "frequent" ? `연결 기출 ${item.frequencyCount || 0}개 빈출 lesson 보강 문항입니다.` : `${formatDateTime(item.dueAt)}에 다시 풀도록 예약된 항목입니다.`}</p>
              </div>
              ${completedToday
                ? `<span class="stitch-completed-label">완료</span>`
                : `<button class="stitch-secondary-button" data-action="start-due-review" data-question-id="${item.itemId}">바로 풀기</button>`}
            </article>
          `;
        })
        .join("")
    : `<div class="stitch-empty-card"><strong>현재 due 복습 항목이 없습니다.</strong><p>이 화면에서는 예정된 복습과 누적 오답만 관리합니다.</p></div>`;
  const wrongHistory = wrongItems.length
    ? wrongItems
        .map((item) => {
          const question = data.questions.find((entry) => entry.id === item.questionId);
          if (!question) {
            return "";
          }

          return `
            <article class="stitch-queue-card compact">
              <div class="stitch-queue-copy">
                <div class="stitch-inline-meta">
                  <span>${findSubjectName(data.subjects, item.subjectId)}</span>
                  <span>오답 ${item.wrongCount}회</span>
                </div>
                <h3>${question.question}</h3>
                <p>최근 오답: ${formatDateTime(item.lastWrongAt)}</p>
              </div>
              <div class="stitch-stack-actions">
                <button
                  class="stitch-primary-button"
                  data-action="review-wrong-answer"
                  data-question-id="${item.questionId}"
                  data-subject-id="${item.subjectId}"
                  data-source-type="${item.sourceType}"
                  data-source-id="${item.sourceId}"
                  data-lesson-id="${item.lessonId || ""}"
                >
                  다시 풀기
                </button>
                <button class="stitch-secondary-button" data-action="toggle-bookmark" data-question-id="${item.questionId}">북마크</button>
              </div>
            </article>
          `;
        })
        .join("")
    : `<div class="stitch-empty-card"><strong>정리되지 않은 오답이 없습니다.</strong><p>현재 범위에서는 복습 대기 문제만 확인하면 됩니다.</p></div>`;

  return stitchLayout(
    activeScope === "mock-exam" ? "모의고사 복습 학습" : "복습 학습",
    "wrong-note",
    `
      <section class="stitch-page-header">
        <div>
          <div class="stitch-badge">Review Session</div>
          <h3>복습 학습</h3>
          <p>${activeScope === "mock-exam" ? "모의고사에서 틀린 문제를 정리하는 화면입니다." : "오늘 다시 볼 문제와 누적 오답을 우선 순위대로 정리합니다."}</p>
        </div>
        ${
          activeScope === "subject"
            ? `
              <label class="stitch-filter-shell">
                <span>과목 선택</span>
                <select data-action="filter-wrong-note">
                  ${unlockedSubjectIds
                    .map(
                      (subjectId) => `
                        <option value="${subjectId}" ${subjectId === selectedSubjectId ? "selected" : ""}>${findSubjectName(data.subjects, subjectId)}</option>
                      `
                    )
                    .join("")}
                </select>
              </label>
            `
            : ""
        }
      </section>

      <section class="stitch-kpi-grid">
        <article class="stitch-kpi-card">
          <span>오늘 복습 큐</span>
          <strong>${reviewItems.length}</strong>
          <p>오늘 복습 대상 문항</p>
        </article>
        <article class="stitch-kpi-card">
          <span>누적 오답</span>
          <strong>${wrongItems.length}</strong>
          <p>아직 정리되지 않은 문제</p>
        </article>
        <article class="stitch-kpi-card">
          <span>복습 규칙</span>
          <strong>1·3·7</strong>
          <p>오답 기준 간격 복습</p>
        </article>
        <article class="stitch-kpi-card is-urgent">
          <span>학습 범위</span>
          <strong>${activeScope === "mock-exam" ? "모의고사" : findSubjectName(data.subjects, selectedSubjectId)}</strong>
          <p>기출 복습만 표시</p>
        </article>
      </section>

      <section class="stitch-dashboard-grid review-mode">
        <section class="stitch-surface-card">
          <div class="stitch-section-head">
            <div>
              <p class="stitch-card-label">Review Queue</p>
              <h3>${activeScope === "mock-exam" ? "모의고사 기출 복습 큐" : `${findSubjectName(data.subjects, selectedSubjectId)} 혼합 복습 큐`}</h3>
            </div>
          </div>
          <div class="stitch-list-stack">
            ${dueCards}
          </div>
        </section>
        <aside class="stitch-side-stack">
          <section class="stitch-surface-card">
            <div class="stitch-section-head">
              <div>
                <p class="stitch-card-label">추천 순서</p>
                <h3>먼저 처리할 항목</h3>
              </div>
            </div>
            <div class="stitch-mini-list">
              ${
                mixedReviewItems.length
                  ? mixedReviewItems
                      .slice(0, 3)
                      .map(
                        (item, index) => `
                          <div class="stitch-mini-row">
                            <strong>${index + 1}. ${findSubjectName(data.subjects, item.subjectId)}</strong>
                            <p>${item.reason === "wrong" ? "오답 정리" : item.reason === "frequent" ? "빈출 반복" : "간격 복습"} · ${item.reason === "frequent" ? `기출 ${item.frequencyCount || 0}개 연결` : formatDateTime(item.dueAt)}</p>
                          </div>
                        `
                      )
                      .join("")
                  : `<p class="stitch-card-copy">추가 due 항목이 없습니다.</p>`
              }
            </div>
          </section>
          <section class="stitch-surface-card">
            <div class="stitch-section-head">
              <div>
                <p class="stitch-card-label">복습 규칙</p>
                <h3>간격 반복 기준</h3>
              </div>
            </div>
            <ul class="stitch-rule-list">
              <li>오늘 복습 큐는 오답 50%, 빈출 반복 30%, 정답 간격복습 20%를 목표로 섞습니다.</li>
              <li>오답 due 문항이 있으면 가장 먼저 배치하고, 빈출 lesson 문항으로 부족분을 보강합니다.</li>
              <li>이 화면은 기출 복습만 포함하며 암기 복습은 별도 화면에서 진행합니다.</li>
            </ul>
          </section>
        </aside>
      </section>

      <section class="stitch-surface-card">
        <div class="stitch-section-head">
          <div>
            <p class="stitch-card-label">Wrong History</p>
            <h3>${activeScope === "mock-exam" ? "모의고사 오답 기록" : "과목 오답 기록"}</h3>
          </div>
        </div>
        <div class="stitch-list-stack">
          ${wrongHistory}
        </div>
      </section>
    `
  );
}

function renderStitchQuiz(data, progress, state) {
  const selectedSubjectId = getSelectedSubjectId(data, progress, state.selectedSubjectId);
  const questionPool = getQuestionPool(data, state, selectedSubjectId);

  if (!questionPool.length) {
    return stitchLayout(
      "문제 풀이",
      "quiz",
      `<div class="stitch-empty-card"><strong>표시할 기출 문제가 없습니다.</strong><p>현재 과목이나 세션 조건에 맞는 문제가 없습니다.</p></div>`
    );
  }

  const activeQuestion = questionPool.find((question) => question.id === state.selectedQuestionId) || questionPool[0];
  const result = state.quizResult;
  const solvedEntry = progress.solvedQuestions[activeQuestion.id];
  const sessionMode = state.quizSession?.mode || "free";
  const reviewReason = state.quizSession?.reason || null;
  const sessionLabel =
    sessionMode === "lesson-quiz"
      ? "신규 기출 문제"
      : sessionMode === "review-queue"
        ? reviewReason === "frequent"
          ? "빈출 반복 문제"
          : reviewReason === "wrong"
            ? "오답 복습 문제"
            : "간격 복습 문제"
        : sessionMode === "wrong-note"
          ? "오답 노트 기출"
          : "자유 기출 풀이";
  const sessionDescription =
    sessionMode === "lesson-quiz"
      ? "현재 lesson과 연결된 기출을 순서대로 풉니다."
      : sessionMode === "review-queue"
        ? reviewReason === "frequent"
          ? `자주 출제된 lesson의 대표 기출을 반복 학습합니다${state.quizSession?.frequencyCount ? ` (${state.quizSession.frequencyCount}문항 연결)` : ""}.`
          : reviewReason === "wrong"
            ? "오늘 due 된 오답 복습 항목을 우선 처리합니다."
            : "오늘 due 된 정답 간격복습 항목을 처리합니다."
        : sessionMode === "wrong-note"
          ? "오답 기록에서 다시 확인해야 하는 문제입니다."
          : "선택한 과목의 기출을 자유롭게 확인합니다.";
  const sessionQuestionIds = state.quizSession?.totalQuestionIds || state.quizSession?.questionIds || [];
  const queueSize = sessionQuestionIds.length || 1;
  const currentQuestionIndex = sessionQuestionIds.indexOf(activeQuestion.id);
  const progressPosition = currentQuestionIndex >= 0 ? currentQuestionIndex + 1 : 1;
  const dailyTarget = buildStudyPlanSummary(data, progress).dailyTarget;
  const dailyQuestionIds = sessionMode === "lesson-quiz" ? dailyTarget.questionIds || [] : [];
  const solvedDailyQuestionIds = dailyQuestionIds.filter((questionId) => progress.solvedQuestions?.[questionId]);
  const activeDailyQuestionCount = sessionMode === "lesson-quiz" && dailyQuestionIds.includes(activeQuestion.id) && !progress.solvedQuestions?.[activeQuestion.id]
    ? 1
    : 0;
  const displayProgressPosition = sessionMode === "lesson-quiz" && dailyQuestionIds.length
    ? Math.min(solvedDailyQuestionIds.length + activeDailyQuestionCount, dailyQuestionIds.length)
    : progressPosition;
  const displayQueueSize = sessionMode === "lesson-quiz" && dailyQuestionIds.length
    ? dailyQuestionIds.length
    : queueSize;
  const displayProgressLabel = sessionMode === "lesson-quiz" && dailyQuestionIds.length
    ? "오늘 전체 기출 기준"
    : sessionLabel;
  const todayReviewCount = sessionMode === "review-queue"
    ? queueSize
    : buildReviewCounts(progress).totalDueCount;
  const nextReviewLabel = result ? (result.isCorrect ? "정답 처리: 다음 간격 복습으로 이동" : "오답 처리: 빠른 복습 큐로 이동") : "";
  const selectedChoice = result ? solvedEntry?.selectedChoice : null;
  const choiceMarkup = activeQuestion.choices
    .map((choice) => {
      const isSelected = selectedChoice === choice.number;
      const isCorrectChoice = result && choice.number === result.correctChoice;
      const isWrongSelection = result && isSelected && !result.isCorrect;
      const optionClass = result
        ? isCorrectChoice
          ? "stitch-option-card is-correct"
          : isWrongSelection
            ? "stitch-option-card is-wrong"
            : "stitch-option-card is-dimmed"
        : "stitch-option-card";

      return `
        <label class="${optionClass}">
          <input type="radio" name="question-choice" value="${choice.number}">
          <span class="stitch-option-index">${choice.number}</span>
          <span class="stitch-option-text">${choice.text}</span>
          ${
            result && isCorrectChoice
              ? `<span class="stitch-option-state">정답</span>`
              : result && isWrongSelection
                ? `<span class="stitch-option-state">선택</span>`
                : ""
          }
        </label>
      `;
    })
    .join("");

  return stitchLayout(
    "문제 풀이",
    "quiz",
    `
      <section class="stitch-kpi-grid">
        <article class="stitch-kpi-card">
          <span>진행률</span>
          <strong>${displayProgressPosition} / ${displayQueueSize}</strong>
          <p>${displayProgressLabel}</p>
        </article>
        <article class="stitch-kpi-card">
          <span>오늘 복습</span>
          <strong>${todayReviewCount}</strong>
          <p>기출 복습 대기 항목</p>
        </article>
        <article class="stitch-kpi-card">
          <span>학습 모드</span>
          <strong>${sessionMode === "review-queue" ? "복습" : sessionMode === "wrong-note" ? "오답" : "신규"}</strong>
          <p>${sessionDescription}</p>
        </article>
        <article class="stitch-kpi-card">
          <span>예상 시간</span>
          <strong>${Math.max(3, queueSize * 2)}분</strong>
          <p>현재 세션 기준</p>
        </article>
      </section>

      <section class="stitch-quiz-grid">
        <section class="stitch-quiz-main">
          <section class="stitch-filter-bar">
            <label class="stitch-filter-shell">
              <span>과목 선택</span>
              <select data-action="select-quiz-subject" ${state.quizSession ? "disabled" : ""}>
                ${getUnlockedSubjectIds(data, progress)
                  .map(
                    (subjectId) => `
                      <option value="${subjectId}" ${subjectId === selectedSubjectId ? "selected" : ""}>${findSubjectName(data.subjects, subjectId)}</option>
                    `
                  )
                  .join("")}
              </select>
            </label>
            <label class="stitch-filter-shell">
              <span>문제 선택</span>
              <select data-action="select-question">
                ${questionPool
                  .map(
                    (question) => `
                      <option value="${question.id}" ${question.id === activeQuestion.id ? "selected" : ""}>${question.source.questionNumber}번 - ${question.id}</option>
                    `
                  )
                  .join("")}
              </select>
            </label>
          </section>

          <article class="stitch-question-card">
            <div class="stitch-question-head">
              <div>
                 <span class="stitch-question-chip">${activeQuestion.source.examDate}</span>
                 <h3>${activeQuestion.question}</h3>
                 ${renderQuestionImages(activeQuestion)}
                 <p>${findSubjectName(data.subjects, activeQuestion.subjectId)} · ${activeQuestion.source.questionNumber}번</p>
              </div>
              <button class="stitch-bookmark-button" data-action="toggle-bookmark" data-question-id="${activeQuestion.id}">
                ${progress.bookmarks.includes(activeQuestion.id) ? "북마크됨" : "북마크"}
              </button>
            </div>

            <div class="stitch-tag-row">
              ${activeQuestion.tags.map((tag) => `<span class="stitch-pill">${tag}</span>`).join("")}
            </div>

            <div class="stitch-option-stack">
              ${choiceMarkup}
            </div>

            ${
              result
                ? `
                  <section class="stitch-explanation-card ${result.isCorrect ? "is-correct" : "is-wrong"}">
                    <div class="stitch-explanation-head">
                      <strong>${result.isCorrect ? "정답입니다." : `오답입니다. 정답은 ${result.correctChoice}번입니다.`}</strong>
                      <span>${nextReviewLabel}</span>
                    </div>
                    <p>${result.explanation}</p>
                  </section>
                `
                : ""
            }

            <div class="stitch-question-actions">
              <button class="stitch-primary-button" data-action="submit-question" data-question-id="${activeQuestion.id}">채점하기</button>
              ${
                result && state.quizSession
                  ? `<button class="stitch-secondary-button" data-action="advance-quiz" data-question-id="${activeQuestion.id}">${getQuizAdvanceLabel(state)}</button>`
                  : `<button class="stitch-secondary-button" data-route="${sessionMode === "wrong-note" || sessionMode === "review-queue" ? "wrong-note" : "home"}">목록으로</button>`
              }
            </div>
          </article>
        </section>

        <aside class="stitch-side-stack">
          <section class="stitch-surface-card">
            <div class="stitch-section-head">
              <div>
                <p class="stitch-card-label">문제 정보</p>
                <h3>${findSubjectName(data.subjects, activeQuestion.subjectId)}</h3>
              </div>
            </div>
            <div class="stitch-mini-list">
              <div class="stitch-mini-row"><strong>출제일</strong><p>${activeQuestion.source.examDate}</p></div>
              <div class="stitch-mini-row"><strong>이전 시도</strong><p>${solvedEntry?.attempts || 0}회</p></div>
              <div class="stitch-mini-row"><strong>북마크</strong><p>${progress.bookmarks.includes(activeQuestion.id) ? "저장됨" : "미저장"}</p></div>
            </div>
          </section>
          <section class="stitch-surface-card">
            <div class="stitch-section-head">
              <div>
                <p class="stitch-card-label">해설 요약</p>
                <h3>핵심 포인트</h3>
              </div>
            </div>
            <p class="stitch-card-copy">${activeQuestion.explanation}</p>
          </section>
          <section class="stitch-surface-card">
            <div class="stitch-section-head">
              <div>
                <p class="stitch-card-label">다시 나온 이유</p>
                <h3>${sessionMode === "review-queue" ? reviewReason === "frequent" ? "빈출 유형 반복" : "오늘 due 문제" : sessionMode === "wrong-note" ? "오답 재확인" : "신규 기출 연결"}</h3>
              </div>
            </div>
            <p class="stitch-card-copy">${
              sessionMode === "review-queue"
                ? reviewReason === "frequent"
                  ? "전체 기출에서 반복 출제 빈도가 높은 lesson의 대표 문제입니다."
                  : "오늘 due 기출 복습 항목이라 바로 이어서 풀이가 진행됩니다."
                : sessionMode === "wrong-note"
                  ? "오답 기록에서 다시 확인해야 하는 문제입니다."
                  : "현재 학습 흐름과 연결된 기출 문제입니다."
            }</p>
          </section>
        </aside>
      </section>
    `,
    sessionMode === "lesson-quiz"
      ? "현재 lesson과 연결된 문제를 모두 풀면 다음 단계로 이동합니다."
      : sessionMode === "review-queue"
        ? "채점 후 다음 문제 버튼으로 due 복습을 계속 진행할 수 있습니다."
        : sessionMode === "wrong-note"
          ? "정답 처리 시 해당 오답 기록이 정리되고 다음 복습 단계로 이어집니다."
          : ""
  );
}

export async function renderApp(root, route, state, options = {}) {
  if (options.requireAuth) {
    root.innerHTML = renderAuthGate(state);
    return;
  }

  const data = await loadAllData();
  const progress = getProgress();

  switch (route) {
    case "concept":
      root.innerHTML = renderConcept(data, progress, state);
      break;
    case "memorization":
      root.innerHTML = renderMemorization(data, progress, state);
      break;
    case "quiz":
      root.innerHTML = renderStitchQuiz(data, progress, state);
      break;
    case "wrong-note":
      root.innerHTML = renderStitchWrongNote(data, progress, state);
      break;
    case "mock-exam":
      root.innerHTML = renderMockExam(data, progress, state);
      break;
    case "progress":
      root.innerHTML = renderProgress(data, progress, state);
      break;
    case "settings":
      root.innerHTML = renderSettings(data, progress);
      break;
    case "home":
    default:
      root.innerHTML = renderStageOneHome(data, progress);
      break;
  }

  typesetMath(root);
  if (options.authRequired) {
    markAuthRequiredActions(root);
  }
  if (state.authNotice) {
    root.insertAdjacentHTML("afterbegin", renderAuthNotice());
  }
}

export async function handleUiAction(event, state, refresh) {
  const routeButton = event.target.closest("[data-route]");
  if (routeButton) {
    const route = routeButton.dataset.route;
    if (route !== "wrong-note" && route !== "quiz") {
      clearReviewMode(state);
      resetQuizSession(state);
    }
    if (routeButton.dataset.subjectId) {
      state.selectedSubjectId = routeButton.dataset.subjectId;
    }
    if (routeButton.dataset.questionId) {
      const question = await getQuestionById(routeButton.dataset.questionId);
      if (question) {
        state.selectedQuestionId = question.id;
        state.selectedSubjectId = routeButton.dataset.subjectId || question.subjectId;
      }
    }
    navigate(route);
    return;
  }

  const actionButton = event.target.closest("[data-action]");
  if (!actionButton) {
    return;
  }

  if (actionButton.tagName === "SELECT" && event.type !== "change") {
    return;
  }

  const { action } = actionButton.dataset;

  if (action === "dismiss-auth-notice") {
    state.authNotice = false;
    await refresh();
    return;
  }

  if (action === "dismiss-auth-gate") {
    state.authGate = false;
    state.authError = null;
    await refresh();
    return;
  }

  if (action === "open-auth-gate") {
    state.authGate = true;
    state.authError = null;
    await refresh();
    return;
  }

  const auth = getCloudAuthState();
  if (auth.configured && !auth.user && AUTH_REQUIRED_ACTIONS.has(action)) {
    state.authNotice = true;
    await refresh();
    return;
  }

  if (["auth-sign-in", "auth-sign-up"].includes(action)) {
    const form = actionButton.closest("[data-auth-form]");
    const email = form?.querySelector("[data-auth-email]")?.value.trim();
    const password = form?.querySelector("[data-auth-password]")?.value;
    if (!email || !password) {
      state.authError = "이메일과 비밀번호를 입력하세요.";
      await refresh();
      return;
    }

    try {
      if (action === "auth-sign-up") {
        await signUpWithPassword(email, password);
      } else {
        await signInWithPassword(email, password);
      }
      state.authError = null;
      state.authGate = false;
      state.authNotice = false;
      const syncedProgress = await syncProgressAfterLogin(getProgress());
      setProgress(syncedProgress);
      await refresh();
    } catch (error) {
      state.authError = error.message || "인증에 실패했습니다.";
      await refresh();
    }
    return;
  }

  if (["cloud-sign-in", "cloud-sign-up"].includes(action)) {
    const panel = actionButton.closest(".panel-card");
    const email = panel?.querySelector("[data-cloud-email]")?.value.trim();
    const password = panel?.querySelector("[data-cloud-password]")?.value;
    if (!email || !password) {
      window.alert("이메일과 비밀번호를 입력하세요.");
      return;
    }

    try {
      if (action === "cloud-sign-up") {
        await signUpWithPassword(email, password);
      } else {
        await signInWithPassword(email, password);
      }
      state.authGate = false;
      state.authNotice = false;
      const syncedProgress = await syncProgressAfterLogin(getProgress());
      setProgress(syncedProgress);
      await refresh();
    } catch (error) {
      window.alert(`클라우드 로그인에 실패했습니다: ${error.message}`);
    }
    return;
  }

  if (action === "cloud-sign-out") {
    try {
      await signOutFromCloud();
      clearProgress();
      await refresh();
    } catch (error) {
      window.alert(`로그아웃에 실패했습니다: ${error.message}`);
    }
    return;
  }

  if (action === "go-home") {
    clearReviewMode(state);
    navigate("home");
    return;
  }

  if (action === "start-due-review") {
    const data = await loadAllData();
    const progress = getProgress();
    const reviewOptions = getRoute() === "wrong-note"
      ? {
          subjectId: state.wrongNoteScope === "mock-exam"
            ? null
            : getSelectedSubjectId(data, progress, state.wrongNoteSubjectId || state.selectedSubjectId),
          sourceType: state.wrongNoteScope === "mock-exam" ? MOCK_EXAM_SOURCE : null
        }
      : {};
    if (!startDueReviewSession(state, progress, data, actionButton.dataset.questionId || null, reviewOptions)) {
      window.alert("오늘 처리할 복습 문항이 없습니다.");
    }
    return;
  }

  if (action === "start-daily-learning") {
    const data = await loadAllData();
    const progress = getProgress();
    await startDailyLearning(data, progress, state);
    return;
  }

  if (action === "start-next-daily-learning") {
    const data = await loadAllData();
    const progress = getProgress();
    await startDailyLearning(data, progress, state);
    return;
  }

  if (action === "start-next-daily-review") {
    const data = await loadAllData();
    const progress = advanceCompletedDailyTargetForStart(data, getProgress());
    if (!startDueReviewSession(state, progress, data)) {
      state.wrongNoteScope = "subject";
      navigate("wrong-note");
    }
    return;
  }

  if (action === "select-subject") {
    clearReviewMode(state);
    state.selectedSubjectId = event.target.value;
    state.selectedLessonId = null;
    await refresh();
    return;
  }

  if (action === "select-study-plan") {
    setStudyPlan(Number(event.target.value));
    await refresh();
    return;
  }

  if (action === "select-lesson") {
    state.selectedLessonId = event.target.value || actionButton.value;
    await refresh();
    return;
  }

  if (action === "complete-lesson") {
    markLessonCompleted(actionButton.dataset.lessonId);
    const data = await loadAllData();
    const lesson = data.lessons.find((entry) => entry.id === actionButton.dataset.lessonId);
    const items = getMemorizationItems(data.lessons).filter((item) => item.lessonId === actionButton.dataset.lessonId);
    updateDailyStudySession(actionButton.dataset.lessonId, {
      stage: "memorization",
      memorizationItemId: items[0]?.id || null,
      memorizationCurrentIndex: 0,
      memorizationCorrectCount: 0
    });
    state.selectedSubjectId = lesson?.subjectId || state.selectedSubjectId;
    state.selectedLessonId = actionButton.dataset.lessonId;
    state.selectedMemorizationItemId = items[0]?.id || null;
    state.memorizationSession = createMemorizationSession(items, actionButton.dataset.lessonId);
    state.memorizationResult = null;
    navigate("memorization");
    return;
  }

  if (action === "select-quiz-subject") {
    clearReviewMode(state);
    state.selectedSubjectId = event.target.value;
    state.selectedQuestionId = null;
    state.quizResult = null;
    resetQuizSession(state);
    await refresh();
    return;
  }

  if (action === "select-question") {
    state.selectedQuestionId = event.target.value;
    state.quizResult = null;
    await refresh();
    return;
  }

  if (action === "submit-question") {
    if (state.quizResult) {
      return;
    }

    const choiceInput = document.querySelector('input[name="question-choice"]:checked');
    if (!choiceInput) {
      window.alert("보기를 선택해 주세요.");
      return;
    }

    const reviewItem = state.quizSession?.mode === "review-queue"
      ? state.quizSession.reviewItems?.find((item) => item.questionId === actionButton.dataset.questionId)
      : null;
    const metadata = reviewItem || state.quizSession
      ? {
          sourceType: reviewItem?.sourceType || state.quizSession.sourceType,
          sourceId: reviewItem?.sourceId || state.quizSession.sourceId,
          lessonId: reviewItem?.lessonId || state.quizSession.lessonId || null
        }
      : {
          sourceType: SUBJECT_QUIZ_SOURCE,
          sourceId: state.selectedSubjectId
        };

    if (state.quizSession?.mode === "review-queue") {
      metadata.reviewMode = "review-queue";
    }

    state.quizResult = await submitAnswer(actionButton.dataset.questionId, Number(choiceInput.value), metadata);

    if (state.quizSession?.mode === "lesson-quiz") {
      markLessonQuestionAnswered(state.quizSession.lessonId, actionButton.dataset.questionId);
      updateDailyStudySession(state.quizSession.lessonId, {
        stage: "quiz",
        selectedQuestionId: actionButton.dataset.questionId,
        lastAnsweredQuestionId: actionButton.dataset.questionId
      });
    }

    await refresh();
    return;
  }

  if (action === "advance-quiz") {
    if (!state.quizSession || !state.quizResult) {
      return;
    }

    if (state.quizSession.mode === "review-queue") {
      const currentIndex = state.quizSession.questionIds.indexOf(state.selectedQuestionId);
      const remainingQuestionIds = state.quizSession.questionIds.slice(currentIndex + 1);

      if (remainingQuestionIds.length) {
        state.quizSession = {
          ...state.quizSession,
          questionIds: remainingQuestionIds
        };
        state.selectedQuestionId = remainingQuestionIds[0];
        state.quizResult = null;
        updateDailyStudySession(state.quizSession.lessonId, {
          stage: "quiz",
          questionIds: remainingQuestionIds,
          selectedQuestionId: state.selectedQuestionId
        });
        await refresh();
        return;
      }

      resetQuizSession(state);
      state.quizResult = null;
      maybeCompleteCurrentDailyTarget(await loadAllData(), getProgress());
      navigate("wrong-note");
      return;
    }

    if (state.quizSession.mode === "lesson-quiz") {
      const data = await loadAllData();
      const progress = getProgress();
      const lesson = data.lessons.find((entry) => entry.id === state.quizSession.lessonId);
      const currentQuestionId = state.selectedQuestionId;

      if (!lesson) {
        resetQuizSession(state);
        state.quizResult = null;
        await refresh();
        return;
      }

      if (state.quizSession.questionIds.length > 1) {
        const remainingQuestionIds = state.quizSession.questionIds.filter((questionId) => questionId !== currentQuestionId);
        state.quizSession = {
          ...state.quizSession,
          questionIds: remainingQuestionIds
        };
        state.selectedQuestionId = remainingQuestionIds[0];
        state.quizResult = null;
        await refresh();
        return;
      }

      resetQuizSession(state);
      state.quizResult = null;
      const progressBeforeClear = getProgress();
      const dailySession = isCurrentDailySession(progressBeforeClear.dailyStudySession)
        && progressBeforeClear.dailyStudySession.lessonId === lesson.id
        ? progressBeforeClear.dailyStudySession
        : null;
      clearDailyStudySessionForLesson(lesson.id);
      if (dailySession) {
        await continueDailyTargetAfterLessonQuiz(data, progress, state, lesson);
        return;
      }
      completeLessonQuizFlow(data, progress, state, lesson);
      return;
    }

    if (state.quizSession.mode === "wrong-note" && state.quizResult.isCorrect) {
      const data = await loadAllData();
      const progress = getProgress();
      const subjectId = state.quizSession.subjectId;
      const sourceType = state.quizSession.sourceType;
      resetQuizSession(state);
      state.quizResult = null;

      if (sourceType === SUBJECT_QUIZ_SOURCE) {
        if (!hasPendingSubjectWrongAnswers(progress, subjectId)) {
          markSubjectWrongNoteCompleted(subjectId);
          const latestProgress = getProgress();
          advanceToNextSubjectOrMock(data, latestProgress, state, subjectId);
          return;
        }

        state.wrongNoteScope = "subject";
        state.wrongNoteSubjectId = subjectId;
        navigate("wrong-note");
        return;
      }

      state.wrongNoteScope = "mock-exam";
      navigate("wrong-note");
      return;
    }

    state.quizResult = null;
    await refresh();
    return;
  }

  if (action === "toggle-bookmark") {
    toggleBookmark(actionButton.dataset.questionId);
    await refresh();
    return;
  }

  if (action === "filter-wrong-note") {
    state.wrongNoteSubjectId = event.target.value;
    state.wrongNoteScope = "subject";
    await refresh();
    return;
  }

  if (action === "review-wrong-answer") {
    clearReviewMode(state);
    startWrongAnswerReviewSession(state, {
      questionId: actionButton.dataset.questionId,
      subjectId: actionButton.dataset.subjectId,
      sourceType: actionButton.dataset.sourceType,
      sourceId: actionButton.dataset.sourceId,
      lessonId: actionButton.dataset.lessonId || null
    });
    navigate("quiz");
    return;
  }

  if (action === "select-memorization-subject") {
    clearReviewMode(state);
    state.selectedSubjectId = event.target.value;
    state.selectedLessonId = null;
    state.selectedMemorizationItemId = null;
    state.memorizationSession = null;
    state.memorizationResult = null;
    await refresh();
    return;
  }

  if (action === "select-memorization-item") {
    const data = await loadAllData();
    const lessons = getLessonsBySubject(data, state.selectedSubjectId || "fire_theory");
    const items = getMemorizationItems(lessons);
    const item = items.find((entry) => entry.id === event.target.value);
    state.selectedMemorizationItemId = event.target.value;
    state.selectedLessonId = item?.lessonId || state.selectedLessonId;
    state.memorizationSession = null;
    state.memorizationResult = null;
    await refresh();
    return;
  }

  if (action === "submit-memorization") {
    if (state.memorizationResult) {
      return;
    }

    const data = await loadAllData();
    const lessons = getLessonsBySubject(data, state.selectedSubjectId || "fire_theory");
    const items = getMemorizationItems(lessons);
    const item = items.find((entry) => entry.id === actionButton.dataset.itemId);
    if (!item) {
      return;
    }
    const lesson = lessons.find((entry) => entry.id === item.lessonId);
    if (!lesson || !isLessonConceptComplete(getProgress(), lesson.id)) {
      window.alert("개념학습을 완료후 학습이 진행됩니다. 완료 버튼을 반드시 눌러주세요.");
      state.selectedSubjectId = lesson?.subjectId || state.selectedSubjectId;
      state.selectedLessonId = lesson?.id || item.lessonId;
      state.memorizationSession = null;
      state.memorizationResult = null;
      navigate("concept");
      return;
    }

    const answer = readMemorizationAnswer(item);
    if (!answer) {
      window.alert("답을 입력하거나 선택해 주세요.");
      return;
    }

    const isCorrect = checkMemorizationAnswer(item, answer);
    saveMemorizationResult(item, isCorrect);
    state.memorizationResult = { isCorrect };
    state.selectedLessonId = item.lessonId;

    const session = state.memorizationSession;
    if (session && session.lessonId === item.lessonId) {
      state.memorizationSession = {
        ...session,
        correctCount: session.correctCount + (isCorrect ? 1 : 0)
      };
      updateDailyStudySession(item.lessonId, {
        stage: "memorization",
        memorizationItemId: item.id,
        memorizationCurrentIndex: session.currentIndex,
        memorizationCorrectCount: session.correctCount + (isCorrect ? 1 : 0)
      });
    }

    await refresh();
    return;
  }

  if (action === "advance-memorization") {
    const data = await loadAllData();
    const lessons = getLessonsBySubject(data, state.selectedSubjectId || "fire_theory");
    const items = getMemorizationItems(lessons);
    const item = items.find((entry) => entry.id === actionButton.dataset.itemId);
    if (!item) {
      return;
    }

    const session = state.memorizationSession;
    if (session && session.lessonId === item.lessonId) {
      const nextIndex = session.currentIndex + 1;

      if (nextIndex < session.itemIds.length) {
        state.memorizationSession = {
          ...session,
          currentIndex: nextIndex
        };
        state.selectedMemorizationItemId = session.itemIds[nextIndex];
        state.memorizationResult = null;
        updateDailyStudySession(item.lessonId, {
          stage: "memorization",
          memorizationItemId: state.selectedMemorizationItemId,
          memorizationCurrentIndex: nextIndex,
          memorizationCorrectCount: session.correctCount
        });
        await refresh();
        return;
      }

      state.memorizationSession = null;
      state.selectedMemorizationItemId = null;

      markLessonMemorizationPassed(item.lessonId);
      const lesson = lessons.find((entry) => entry.id === item.lessonId);
      const progress = getProgress();

      if (!lesson) {
        navigate("concept");
        return;
      }

      const relatedQuestionIds = getRelatedQuestionIds(lesson);
      if (relatedQuestionIds.length) {
        const questionIds = startLessonQuizSession(state, progress, lesson);
        updateDailyStudySession(item.lessonId, {
          stage: "quiz",
          questionIds,
          totalQuestionIds: questionIds,
          selectedQuestionId: questionIds[0] || null
        });
        navigate("quiz");
        return;
      }

      completeLessonQuizFlow(data, progress, state, lesson);
      return;
    }

    const activeLessonId = state.selectedLessonId || item.lessonId;
    const availableItems = items.filter((entry) => entry.lessonId === activeLessonId);
    const currentIndex = availableItems.findIndex((entry) => entry.id === item.id);
    const nextItem = currentIndex >= 0 ? availableItems[currentIndex + 1] : null;

    if (state.reviewMode) {
      state.memorizationResult = null;
      const data = await loadAllData();
      const progress = getProgress();
      if (!startDueReviewSession(state, progress, data, null, state.reviewFilters || {})) {
        await refresh();
      }
      return;
    }

    if (!nextItem) {
      window.alert("현재 lesson의 마지막 암기 문항입니다.");
      state.memorizationResult = null;
      await refresh();
      return;
    }

    state.selectedMemorizationItemId = nextItem.id;
    state.selectedLessonId = nextItem.lessonId;
    state.memorizationResult = null;
    await refresh();
    return;
  }

  if (action === "fill-hint") {
    const data = await loadAllData();
    const lessons = getLessonsBySubject(data, state.selectedSubjectId || "fire_theory");
    const items = getMemorizationItems(lessons);
    const item = items.find((entry) => entry.id === (state.selectedMemorizationItemId || items[0]?.id));
    if (item) {
      window.alert(`힌트: ${item.hint}`);
    }
    return;
  }

  if (action === "start-mock-exam") {
    const data = await loadAllData();
    const mockExams = Array.isArray(data.mockExam) ? data.mockExam : [data.mockExam];
    const selectedMockExam = mockExams.find((exam) => exam.id === actionButton.dataset.mockExamId) || mockExams.find((exam) => exam.id === state.selectedMockExamId) || mockExams[0];
    state.selectedMockExamId = selectedMockExam?.id || null;
    await startMockExam(selectedMockExam);
    state.mockExamResult = null;
    await refresh();
    return;
  }

  if (action === "select-mock-exam") {
    state.selectedMockExamId = actionButton.dataset.mockExamId || null;
    state.mockExamResult = null;
    await refresh();
    return;
  }

  if (action === "select-exam-answer") {
    selectExamAnswer(actionButton.dataset.questionId, event.target.value);
    return;
  }

  if (action === "submit-mock-exam") {
    state.mockExamResult = submitMockExam();
    state.wrongNoteScope = "mock-exam";
    navigate("wrong-note");
    return;
  }

  if (action === "open-mock-wrong-note") {
    state.wrongNoteScope = "mock-exam";
    navigate("wrong-note");
    return;
  }

  if (action === "reset-progress") {
    resetProgress();
    state.quizResult = null;
    state.memorizationResult = null;
    state.mockExamResult = null;
    state.quizSession = null;
    clearReviewMode(state);
    state.wrongNoteScope = "subject";
    await refresh();
    return;
  }

  if (action === "reload-app") {
    window.location.reload();
  }
}
