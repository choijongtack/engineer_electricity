import { getRoute, navigate, onRouteChange } from "./router.js";
import { handleUiAction, renderApp } from "./ui.js";
import { getProgress, setProgress } from "./storage.js";
import { getCloudAuthState, initializeCloudSync, syncProgressAfterLogin } from "./cloudSync.js";

const root = document.querySelector("#app");
const APP_BUILD_VERSION = "mobile-render-fix-2026-07-14-1";

const state = {
  selectedSubjectId: "fire_theory",
  selectedLessonId: null,
  selectedQuestionId: null,
  selectedMemorizationItemId: null,
  memorizationSession: null,
  quizSession: null,
  wrongNoteSubjectId: "all",
  wrongNoteScope: "subject",
  reviewMode: false,
  quizResult: null,
  memorizationResult: null,
  mockExamResult: null,
  selectedMockExamId: null,
  authError: null,
  authGate: false,
  authNotice: false
};

async function refresh() {
  const auth = getCloudAuthState();
  await renderApp(root, getRoute(), state, {
    authRequired: auth.configured && !auth.user,
    requireAuth: auth.configured && !auth.user && state.authGate
  });
}

async function init() {
  console.info("JT Academy build:", APP_BUILD_VERSION);

  // Firebase Auth가 설정된 배포 환경에서는 인증 후에만 학습 화면을 엽니다.
  // Firebase 설정이 없는 로컬 개발 환경은 기존 guest 흐름을 유지합니다.

  if (!window.location.hash) {
    navigate("home");
  }

  onRouteChange(async () => {
    state.quizResult = null;
    if (getRoute() !== "memorization") {
      state.memorizationResult = null;
    }
    if (!["quiz", "memorization"].includes(getRoute())) {
      state.reviewMode = false;
    }
    await refresh();
  });

  document.addEventListener("click", async (event) => {
    await handleUiAction(event, state, refresh);
  });

  document.addEventListener("change", async (event) => {
    await handleUiAction(event, state, refresh);
  });

  // Render the local learning UI before waiting for Firebase CDN responses.
  // This keeps the app usable when mobile networks delay or block Firebase SDK.
  root.innerHTML = `
    <section class="app-shell">
      <article class="feedback-panel">
        <strong>학습 화면을 준비하는 중입니다.</strong>
        <p>학습 데이터를 불러오고 있습니다. 모바일에서는 잠시 더 걸릴 수 있습니다.</p>
      </article>
    </section>
  `;
  await refresh();

  try {
    const cloudUser = await initializeCloudSync();
    if (cloudUser) {
      const syncedProgress = await syncProgressAfterLogin(getProgress());
      setProgress(syncedProgress);
      await refresh();
    }
  } catch (error) {
    // Firebase 연결 실패가 로컬 학습 화면을 막지 않도록 합니다.
    console.warn("Firebase 동기화를 건너뜁니다. 로컬 학습 모드로 계속합니다.", error);
  }
}

init().catch((error) => {
  root.innerHTML = `
    <section class="app-shell">
      <article class="feedback-panel is-wrong">
        <strong>앱 초기화 중 오류가 발생했습니다.</strong>
        <p>${error.message}</p>
        <p>정적 서버로 실행 중인지 확인해 주세요.</p>
      </article>
    </section>
  `;
});
