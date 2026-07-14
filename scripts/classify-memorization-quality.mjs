import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getMemorizationItems } from "../src/memorizationEngine.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const lessons = readJson(path.join(repoRoot, "data", "fire_lessons.json"));
const subjects = readJson(path.join(repoRoot, "data", "fire_subjects.json"));
const subjectNameById = new Map(
  subjects.map((subject) => [subject.id, subject.name || subject.title || subject.id])
);

const groupedItems = new Map();
for (const item of getMemorizationItems(lessons)) {
  if (!groupedItems.has(item.lessonId)) {
    groupedItems.set(item.lessonId, []);
  }
  groupedItems.get(item.lessonId).push(item);
}

const rows = lessons.map((lesson) => classifyLesson(lesson, groupedItems.get(lesson.id) || [], subjectNameById));
const goodRows = rows.filter((row) => row.classification === "good");
const needsRefinementRows = rows.filter((row) => row.classification === "needs_refinement");

const summary = {
  generatedAt: new Date().toISOString(),
  totalLessons: rows.length,
  goodLessons: goodRows.length,
  needsRefinementLessons: needsRefinementRows.length,
  bySubject: summarizeBySubject(rows),
  topNeedsRefinement: needsRefinementRows
    .slice()
    .sort((a, b) => a.score - b.score)
    .slice(0, 20)
    .map(toCompactRow)
};

const report = {
  summary,
  lessons: rows
};

const tmpDir = path.join(repoRoot, "tmp");
fs.mkdirSync(tmpDir, { recursive: true });
fs.writeFileSync(
  path.join(tmpDir, "memorization_quality_report.json"),
  JSON.stringify(report, null, 2),
  "utf8"
);
fs.writeFileSync(
  path.join(tmpDir, "memorization_quality_report.md"),
  buildMarkdown(report),
  "utf8"
);

console.log(JSON.stringify(summary, null, 2));

function classifyLesson(lesson, items, subjectNameById) {
  const recall = items.find((item) => item.id.startsWith("MC_")) || items[0] || null;
  const cloze = items.find((item) => item.id.startsWith("BQ_")) || items[1] || null;
  const reasons = [];
  let score = 100;

  if (!recall || !cloze) {
    reasons.push("문항 2개 구성이 완전하지 않음");
    score -= 60;
  }

  if (recall) {
    const recallResult = evaluateRecall(lesson, recall);
    score += recallResult.delta;
    reasons.push(...recallResult.reasons);
  }

  if (cloze) {
    const clozeResult = evaluateCloze(lesson, cloze);
    score += clozeResult.delta;
    reasons.push(...clozeResult.reasons);
  }

  if (recall && cloze && normalize(recall.answer) === normalize(cloze.answer)) {
    reasons.push("암기형과 빈칸형 답안이 사실상 동일함");
    score -= 15;
  }

  const finalScore = Math.max(0, Math.min(100, score));
  const classification = finalScore >= 70 ? "good" : "needs_refinement";

  return {
    lessonId: lesson.id,
    lessonTitle: lesson.title,
    subjectId: lesson.subjectId,
    subjectTitle: subjectNameById.get(lesson.subjectId) || lesson.subjectId,
    score: finalScore,
    classification,
    reasons: unique(reasons),
    recall: recall ? pickItemFields(recall) : null,
    cloze: cloze ? pickItemFields(cloze) : null
  };
}

function evaluateRecall(lesson, item) {
  const reasons = [];
  let delta = 0;
  const answer = String(item.answer || "").trim();
  const prompt = String(item.prompt || "").trim();

  if (!answer) {
    reasons.push("암기형 답안이 비어 있음");
    return { delta: -50, reasons };
  }

  if (normalize(answer) === normalize(lesson.title)) {
    reasons.push("암기형 답안이 lesson 제목 반복에 가까움");
    delta -= 35;
  }

  if (hasFormula(answer)) {
    reasons.push("암기형 답안이 공식형이라 직접 암송 가치가 높음");
    delta += 8;
  } else if (hasNumber(answer)) {
    reasons.push("암기형 답안이 수치 기준을 담고 있음");
    delta += 8;
  } else if (isListAnswer(answer)) {
    reasons.push("암기형 답안이 열거형이라 회상 문제로 적합함");
    delta += 6;
  }

  if (isGenericAnswer(answer)) {
    reasons.push("암기형 답안이 추상 명사형이라 보정 필요");
    delta -= 22;
  }

  if (isWeakPrompt(prompt)) {
    reasons.push("암기형 프롬프트가 너무 포괄적임");
    delta -= 12;
  }

  return { delta, reasons };
}

function evaluateCloze(lesson, item) {
  const reasons = [];
  let delta = 0;
  const answer = String(item.answer || "").trim();
  const prompt = String(item.prompt || "").trim();

  if (!answer) {
    reasons.push("빈칸형 답안이 비어 있음");
    return { delta: -50, reasons };
  }

  if (!prompt.includes("(    )")) {
    reasons.push("빈칸형 프롬프트에 실제 빈칸 표시가 없음");
    delta -= 35;
  }

  if (isGenericClozePrompt(prompt, lesson.title)) {
    reasons.push("빈칸형 프롬프트가 템플릿 문장에 가까움");
    delta -= 26;
  } else {
    reasons.push("빈칸형 프롬프트가 문맥 속 빈칸을 제공함");
    delta += 6;
  }

  if (isGenericAnswer(answer)) {
    reasons.push("빈칸형 답안이 추상 조각이라 보정 필요");
    delta -= 18;
  }

  if (answer.length <= 1) {
    reasons.push("빈칸형 답안 길이가 지나치게 짧음");
    delta -= 15;
  }

  if (hasFormula(answer) || hasNumber(answer)) {
    reasons.push("빈칸형 답안이 공식 또는 수치라 검증성이 높음");
    delta += 6;
  }

  return { delta, reasons };
}

function isWeakPrompt(prompt) {
  return /핵심 (개념|내용|기준|항목|키워드)을 쓰세요/u.test(prompt);
}

function isGenericClozePrompt(prompt, lessonTitle) {
  const normalized = normalize(prompt);
  return (
    normalized === normalize(`${lessonTitle}의 핵심 키워드는 (    )이다.`) ||
    normalized === normalize(`${lessonTitle}의 핵심 단어는 (    )이다.`) ||
    normalized === normalize(`${lessonTitle}의 암기 단어는 (    )이다.`) ||
    /핵심 (키워드|단어)는\s*\(\s*\)\s*이다/u.test(prompt) ||
    /암기 단어는\s*\(\s*\)\s*이다/u.test(prompt)
  );
}

function isGenericAnswer(answer) {
  const value = String(answer || "").trim();
  if (!value) {
    return true;
  }
  if (hasFormula(value) || hasNumber(value) || isListAnswer(value)) {
    return false;
  }
  if (value.length <= 2) {
    return true;
  }
  return /(개념|구분|구조|원리|내용|항목|요소|사항|정리|기준|대상 구분|전원 구조|출발점|포인트)$/u.test(value);
}

function hasFormula(text) {
  return /[A-Za-z]\s*=\s*[A-Za-z0-9]/u.test(text) || text.includes("+");
}

function hasNumber(text) {
  return /\d/u.test(text);
}

function isListAnswer(text) {
  return /[,·]| 그리고 | 및 | 또는 /u.test(text);
}

function normalize(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.,]/g, "");
}

function pickItemFields(item) {
  return {
    prompt: item.prompt,
    answer: item.answer,
    hint: item.hint
  };
}

function summarizeBySubject(rows) {
  const map = new Map();
  for (const row of rows) {
    const current = map.get(row.subjectId) || {
      subjectId: row.subjectId,
      subjectTitle: row.subjectTitle,
      totalLessons: 0,
      goodLessons: 0,
      needsRefinementLessons: 0
    };
    current.totalLessons += 1;
    if (row.classification === "good") {
      current.goodLessons += 1;
    } else {
      current.needsRefinementLessons += 1;
    }
    map.set(row.subjectId, current);
  }
  return [...map.values()];
}

function toCompactRow(row) {
  return {
    lessonId: row.lessonId,
    lessonTitle: row.lessonTitle,
    subjectTitle: row.subjectTitle,
    score: row.score,
    reasons: row.reasons,
    recallAnswer: row.recall?.answer || "",
    clozeAnswer: row.cloze?.answer || ""
  };
}

function buildMarkdown(report) {
  const lines = [];
  lines.push("# Memorization Quality Report");
  lines.push("");
  lines.push(`- Generated: ${report.summary.generatedAt}`);
  lines.push(`- Total lessons: ${report.summary.totalLessons}`);
  lines.push(`- Good: ${report.summary.goodLessons}`);
  lines.push(`- Needs refinement: ${report.summary.needsRefinementLessons}`);
  lines.push("");
  lines.push("## By Subject");
  lines.push("");
  lines.push("| Subject | Total | Good | Needs refinement |");
  lines.push("| --- | ---: | ---: | ---: |");
  for (const row of report.summary.bySubject) {
    lines.push(`| ${row.subjectTitle} | ${row.totalLessons} | ${row.goodLessons} | ${row.needsRefinementLessons} |`);
  }
  lines.push("");
  lines.push("## Needs Refinement Top 20");
  lines.push("");
  lines.push("| Lesson ID | Lesson | Subject | Score | Recall answer | Cloze answer | Reasons |");
  lines.push("| --- | --- | --- | ---: | --- | --- | --- |");
  for (const row of report.summary.topNeedsRefinement) {
    lines.push(
      `| ${row.lessonId} | ${escapePipes(row.lessonTitle)} | ${escapePipes(row.subjectTitle)} | ${row.score} | ${escapePipes(row.recallAnswer)} | ${escapePipes(row.clozeAnswer)} | ${escapePipes(row.reasons.join("; "))} |`
    );
  }
  return `${lines.join("\n")}\n`;
}

function escapePipes(value) {
  return String(value || "").replace(/\|/g, "\\|");
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}
