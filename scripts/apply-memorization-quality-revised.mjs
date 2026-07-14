import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const reportPath = path.join(repoRoot, "tmp", "memorization_quality_report_revised.json");
const lessonsPath = path.join(repoRoot, "data", "fire_lessons.json");

const report = readJson(reportPath);
const lessons = readJson(lessonsPath);
const reportMap = new Map(report.lessons.map((lesson) => [lesson.lessonId, lesson]));

let updatedLessons = 0;
let updatedItems = 0;

for (const lesson of lessons) {
  const revised = reportMap.get(lesson.id);
  if (!revised) {
    continue;
  }

  const memorizationItems = Array.isArray(lesson.memorizationItems) ? lesson.memorizationItems : [];
  let lessonChanged = false;

  for (const item of memorizationItems) {
    if (item.id === `MC_${lesson.id}` && revised.recall) {
      applyRevision(item, revised.recall, "암기 답안");
      updatedItems += 1;
      lessonChanged = true;
      continue;
    }

    if (item.id === `BQ_${lesson.id}` && revised.cloze) {
      applyRevision(item, revised.cloze, "빈칸 답안");
      updatedItems += 1;
      lessonChanged = true;
    }
  }

  if (lessonChanged) {
    updatedLessons += 1;
  }
}

fs.writeFileSync(lessonsPath, `${JSON.stringify(lessons, null, 2)}\n`, "utf8");

console.log(
  JSON.stringify(
    {
      reportLessons: report.lessons.length,
      updatedLessons,
      updatedItems,
      lessonsPath
    },
    null,
    2
  )
);

function applyRevision(item, revised, answerLabel) {
  item.type = "short-answer";
  item.prompt = revised.prompt;
  item.answer = revised.answer;
  item.acceptableAnswers = buildAcceptableAnswers(revised.answer);
  item.hint = revised.hint;
  item.answerLabel = answerLabel;
}

function buildAcceptableAnswers(answer) {
  const normalized = String(answer || "").trim();
  const compact = normalized.replace(/\s+/g, "");
  return [...new Set([normalized, compact].filter(Boolean))];
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}
