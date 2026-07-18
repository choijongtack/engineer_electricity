import { chromium } from "@playwright/test";
import fs from "node:fs/promises";

const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:8082/?emulator=1";
const email = process.env.TEST_EMAIL || "test-emulator@example.com";
const password = process.env.TEST_PASSWORD || "Test123456!";
const maxDays = Number(process.env.TEST_DAYS || 30);
const reportPath = "tests/reports/30-day-background/run.md";
const questions = JSON.parse(await fs.readFile("data/fire_questions.json", "utf8"));
const questionById = new Map(questions.map((question) => [question.id, question]));

async function log(message) {
  await fs.mkdir("tests/reports/30-day-background", { recursive: true });
  await fs.appendFile(reportPath, `${new Date().toISOString()} ${message}\n`);
}

async function visibleCount(page, selector) {
  return page.locator(`${selector}:visible`).count();
}

async function login(page) {
  await page.goto(`${baseUrl.split("?")[0]}?emulator=1#home`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);
  const gate = page.locator('[data-action="open-auth-gate"]:visible');
  if (await gate.count()) {
    await gate.click();
    await page.waitForTimeout(300);
  }
  const emailInput = page.locator('[data-auth-email]:visible, [data-cloud-email]:visible');
  if (await emailInput.count()) {
    await emailInput.fill(email);
    await page.locator('[data-auth-password]:visible, [data-cloud-password]:visible').fill(password);
    await page.locator('[data-action="auth-sign-in"]:visible, [data-action="cloud-sign-in"]:visible').click();
    await page.waitForTimeout(1200);
  }
  const account = page.locator(`[data-cloud-email], [data-auth-email]`);
  await log(`login accountVisible=${await account.count() > 0}`);
}

async function completeMemorization(page, day) {
  for (let guard = 0; guard < 100; guard += 1) {
    const next = page.locator('[data-action="advance-memorization"]:visible');
    if (await next.count()) {
      await next.click();
      await page.waitForTimeout(180);
      continue;
    }
    const submit = page.locator('[data-action="submit-memorization"]:visible');
    if (await submit.count()) {
      const answer = page.locator("#memorization-answer:visible");
      if (await answer.count()) await answer.fill("테스트 답변");
      const choice = page.locator('input[name="memorization-choice"]:visible');
      if (await choice.count()) await choice.first().check({ force: true });
      await submit.click();
      await page.waitForTimeout(180);
      continue;
    }
    if (await visibleCount(page, '[data-action="submit-question"]')) return;
    await page.waitForTimeout(250);
  }
  throw new Error(`day ${day}: memorization did not reach quiz`);
}

async function completeQuiz(page, day, keepWrongRate = true) {
  let answered = 0;
  const seen = new Set();
  for (let guard = 0; guard < 1000; guard += 1) {
    const advance = page.locator('[data-action="advance-quiz"]:visible');
    if (await advance.count()) {
      await advance.click({ timeoutMs: 5000 });
      await page.waitForTimeout(180);
      continue;
    }
    const submit = page.locator('[data-action="submit-question"]:visible');
    if (await submit.count()) {
      const questionId = await submit.getAttribute("data-question-id");
      const question = questionById.get(questionId);
      const answer = question?.answer || 1;
      const selected = keepWrongRate && answered % 5 === 4 ? (answer % 4) + 1 : answer;
      const choice = page.locator(`input[name="question-choice"][value="${selected}"]`);
      const choiceCount = await choice.count();
      await log(`day ${day} quiz-before id=${questionId} answer=${answer} selected=${selected} choice=${choiceCount}`);
      if (!choiceCount) throw new Error(`day ${day}: choice missing for ${questionId}`);
      try {
        await choice.check({ force: true, timeoutMs: 5000 });
      } catch (error) {
        const label = page.locator(`label:has(input[name="question-choice"][value="${selected}"]):visible`);
        if (!(await label.count())) throw error;
        await label.click({ force: true, timeoutMs: 5000 });
      }
      await log(`day ${day} quiz-selected id=${questionId}`);
      await submit.click({ timeoutMs: 5000 });
      answered += 1;
      if (questionId) seen.add(questionId);
      await page.waitForTimeout(180);
      continue;
    }
    break;
  }
  await log(`day ${day} quiz answered=${answered} unique=${seen.size} route=${await page.evaluate(() => location.hash)}`);
  if (!answered) throw new Error(`day ${day}: no quiz question answered`);
}

async function auditHome(page, day, label) {
  await page.goto(`${baseUrl.split("?")[0]}?emulator=1#home`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(700);
  const buttons = await page.locator("button:visible").evaluateAll((items) => items.map((button) => ({
    text: button.innerText.trim().replace(/\s+/g, " "),
    action: button.dataset.action || null,
    route: button.dataset.route || null,
    disabled: button.disabled
  })).filter((button) => button.action || button.route));
  const metrics = await page.locator("body").innerText();
  const metricLines = metrics.split("\\n").map((line) => line.trim()).filter(Boolean);
  const progressTerms = ["개념 완료", "오늘 복습", "정답률", "오늘 진행률", "전체 진행률"];
  const progress = {};
  for (const term of progressTerms) {
    const index = metricLines.indexOf(term);
    progress[term] = index >= 1 ? metricLines[index - 1] : null;
  }
  await log(`day ${day} ${label} progress=${JSON.stringify(progress)} buttons=${JSON.stringify(buttons)}`);
  return buttons;
}

const context = await chromium.launchPersistentContext("tests/.playwright-profile-30d", { headless: true, viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
page.on("dialog", async (dialog) => { await log(`dialog ${dialog.message()}`); await dialog.dismiss(); });
try {
  await fs.mkdir("tests/reports/30-day-background", { recursive: true });
  await fs.writeFile(reportPath, "# 30-day background learning test\n\n");
  await login(page);
  for (let day = 1; day <= maxDays; day += 1) {
    const before = await auditHome(page, day, "before");
    for (let lessonGuard = 0; lessonGuard < 10; lessonGuard += 1) {
      const startCandidates = page.locator('[data-action="start-daily-learning"]:visible, [data-action="start-next-daily-learning"]:visible');
      const startCount = await startCandidates.count();
      if (!startCount) break;
      const start = startCount === 1 ? startCandidates : startCandidates.last();
      if (!(await start.isEnabled())) throw new Error(`day ${day}: daily start disabled`);
      await start.click();
      const completeLesson = page.locator('[data-action="complete-lesson"]:visible');
      await page.waitForTimeout(500);
      const startRoute = await page.evaluate(() => location.hash);
      await log(`day ${day} lesson=${lessonGuard + 1} after-start route=${startRoute} complete=${await completeLesson.count()}`);
      if (startRoute !== "#quiz" && !(await completeLesson.count())) {
        const lessonProgress = page.locator('button[data-route="concept"]:visible');
        const lessonCount = await lessonProgress.count();
        await log(`day ${day} start-recovery lessonButtons=${lessonCount}`);
        if (lessonCount) await lessonProgress.last().click();
      }
      if (startRoute !== "#quiz") {
        await completeLesson.waitFor({ state: "visible", timeout: 15000 });
        await completeLesson.click();
        await page.waitForTimeout(250);
        await completeMemorization(page, day);
      }
      await completeQuiz(page, day);
      const lessonState = await auditHome(page, day, `after-lesson-${lessonGuard + 1}`);
      if (lessonState.some((button) => button.action === "start-next-daily-learning" && !button.disabled)) break;
    }
    let after = await auditHome(page, day, "after-learning");
    let hasNext = after.some((button) => button.action === "start-next-daily-learning" && !button.disabled);
    let hasReview = after.some((button) => button.action === "start-due-review" && !button.disabled);
    if (hasReview) {
      const reviewStart = page.locator('[data-action="start-due-review"]:visible');
      await reviewStart.last().click();
      await page.waitForTimeout(300);
      await completeQuiz(page, `${day}-review`, false);
      after = await auditHome(page, day, "after-review");
      hasNext = after.some((button) => button.action === "start-next-daily-learning" && !button.disabled);
      hasReview = after.some((button) => button.action === "start-due-review" && !button.disabled);
    }
    await log(`day ${day} result hasNext=${hasNext} hasReview=${hasReview}`);
    if (!hasNext && day < maxDays) throw new Error(`day ${day}: next-day button not available`);
  }
  await log("TEST_FINISHED");
} catch (error) {
  await log(`TEST_FAILED ${error.stack || error}`);
  process.exitCode = 1;
} finally {
  await context.close();
}
