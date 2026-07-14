import { getRoute, navigate, onRouteChange } from "./router.js";
import { handleUiAction, renderApp } from "./ui.js";
import { getProgress, getStorageKey } from "./storage.js";
import { initializeCloudSync, syncProgressAfterLogin } from "./cloudSync.js";

const root = document.querySelector("#app");

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
  mockExamResult: null
};

async function refresh() {
  await renderApp(root, getRoute(), state);
}

async function init() {
  const cloudUser = await initializeCloudSync();
  if (cloudUser) {
    const syncedProgress = await syncProgressAfterLogin(getProgress());
    localStorage.setItem(getStorageKey(), JSON.stringify(syncedProgress));
  }

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

  await refresh();
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
