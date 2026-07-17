import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const rawDir = path.resolve("data/raw/cbtbank");
const wrongNoteMarker = "\uC624\uB2F5 \uB178\uD2B8";

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeExplanation(explanation, choices, answer) {
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
      const normalized = normalizeExplanation(question.explanation || "", question.choices, question.answer);
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

  console.log(JSON.stringify({ changedFiles, changedQuestions, insertedBoundaries }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
