import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const rawDir = path.resolve("data/raw/cbtbank");
const runtimeQuestionsPath = path.resolve("data/fire_questions.json");
const wrongNoteMarker = "\uC624\uB2F5 \uB178\uD2B8";
const boundaryTerms = [
  "방화구조",
  "내화구조",
  "혼재 불가",
  "혼재 가능",
  "위험물",
  "해당함",
  "해당하지 않음",
  "가능함",
  "불가능함",
  "맞음",
  "틀림",
  "질식소화",
  "냉각소화",
  "제거소화",
  "억제소화"
];
const particles = "(?:(?:의|은|는|이|가|을|를|와|과|에|로|도|만)(?![가-힣])|으로|이며|이고|입니다)";
const boundaryPattern = new RegExp(
  `(${boundaryTerms.map(escapeRegExp).join("|")})(?!(?:${particles}))(?=[가-힣A-Za-z0-9$\\\\[])`,
  "g"
);
const particleBreakPattern = new RegExp(
  `(${boundaryTerms.map(escapeRegExp).join("|")})\\n(${particles})`,
  "g"
);

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeExplanation(explanation, choices, answer) {
  const periodBoundaries = countMatches(explanation, /다\.(?=\S)/g);
  let value = explanation.replace(/다\.(?=\S)/g, "다.\n");
  value = value.replace(particleBreakPattern, "$1$2");

  const refreshedMarkerIndex = value.indexOf(wrongNoteMarker);
  if (refreshedMarkerIndex < 0) {
    return { value, boundaries: periodBoundaries };
  }

  const before = value.slice(0, refreshedMarkerIndex).trimEnd();
  let suffix = value.slice(refreshedMarkerIndex + wrongNoteMarker.length).trim();
  let boundaries = periodBoundaries;

  suffix = suffix.replace(boundaryPattern, (match) => {
    boundaries += 1;
    return `${match}\n`;
  });
  suffix = suffix.replace(/(\\text\{kg\}\$)(?=[가-힣A-Za-z])/g, (_match, unit) => {
    boundaries += 1;
    return `${unit}\n`;
  });

  for (const [index, choice] of (choices || []).entries()) {
    const choiceNumber = typeof choice === "string" ? index + 1 : choice.number;
    const choiceText = typeof choice === "string" ? choice : choice.text;
    if (choiceNumber === answer || typeof choiceText !== "string") {
      continue;
    }

    const label = choiceText.trim();
    if (!label || !suffix.includes(`${label}:`)) {
      continue;
    }

    const pattern = new RegExp(`([^\\n])${escapeRegExp(label)}:`, "g");
    suffix = suffix.replace(pattern, (_match, prefix) => {
      boundaries += 1;
      return `${prefix}\n${label}:`;
    });
  }

  return {
    value: `${before}\n${wrongNoteMarker}\n${suffix}`,
    boundaries
  };
}

function countMatches(value, pattern) {
  return [...value.matchAll(pattern)].length;
}

function normalizeRawExplanation(explanation, choices, answer) {
  const markerIndex = explanation.indexOf(wrongNoteMarker);
  if (markerIndex < 0) {
    return { value: explanation, boundaries: 0 };
  }

  const before = explanation.slice(0, markerIndex).trimEnd();
  let suffix = explanation.slice(markerIndex + wrongNoteMarker.length).trim();
  let boundaries = 0;

  for (const [index, choice] of (choices || []).entries()) {
    const choiceNumber = typeof choice === "string" ? index + 1 : choice.number;
    const choiceText = typeof choice === "string" ? choice : choice.text;
    if (choiceNumber === answer || typeof choiceText !== "string") {
      continue;
    }

    const label = choiceText.trim();
    if (!label || !suffix.includes(`${label}:`)) {
      continue;
    }

    const pattern = new RegExp(`([^\\n])${escapeRegExp(label)}:`, "g");
    suffix = suffix.replace(pattern, (_match, prefix) => {
      boundaries += 1;
      return `${prefix}\n${label}:`;
    });
  }

  return {
    value: `${before}\n${wrongNoteMarker}\n${suffix}`,
    boundaries
  };
}

async function main() {
  const files = (await readdir(rawDir)).filter((file) => file.endsWith(".json")).sort();
  let changedFiles = 0;
  let changedQuestions = 0;
  let insertedBoundaries = 0;

  for (const file of files) {
    const filePath = path.join(rawDir, file);
    const exam = JSON.parse(await readFile(filePath, "utf8"));
    let changed = false;

    for (const question of exam.questions || []) {
      const normalized = normalizeRawExplanation(question.explanation || "", question.choices, question.answer);
      if (normalized.value === question.explanation) {
        continue;
      }

      question.explanation = normalized.value;
      changed = true;
      changedQuestions += 1;
      insertedBoundaries += normalized.boundaries;
    }

    if (changed) {
      await writeFile(filePath, `${JSON.stringify(exam, null, 2)}\n`, "utf8");
      changedFiles += 1;
    }
  }

  const runtimeQuestions = JSON.parse(await readFile(runtimeQuestionsPath, "utf8"));
  let runtimeChangedQuestions = 0;
  let runtimeInsertedBoundaries = 0;

  for (const question of runtimeQuestions) {
    const normalized = normalizeExplanation(question.explanation || "", question.choices, question.answer);
    if (normalized.value === question.explanation) {
      continue;
    }

    question.explanation = normalized.value;
    runtimeChangedQuestions += 1;
    runtimeInsertedBoundaries += normalized.boundaries;
  }

  if (runtimeChangedQuestions > 0) {
    await writeFile(runtimeQuestionsPath, `${JSON.stringify(runtimeQuestions, null, 2)}\n`, "utf8");
  }

  console.log(JSON.stringify({
    changedFiles,
    changedQuestions,
    insertedBoundaries,
    runtimeChangedQuestions,
    runtimeInsertedBoundaries
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
