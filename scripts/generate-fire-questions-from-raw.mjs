import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = path.resolve(".");
const rawDir = path.join(repoRoot, "data", "raw", "cbtbank");
const outputPath = path.join(repoRoot, "data", "fire_questions.json");

const subjectIds = {
  "소방원론": "fire_theory",
  "소방전기회로": "electric_circuit",
  "소방관계법규": "fire_law",
  "소방전기시설의 구조 및 원리": "fire_facility_electric"
};

const chapterIds = {
  fire_theory: "fire_theory_general",
  electric_circuit: "electric_circuit_general",
  fire_law: "fire_law_general",
  fire_facility_electric: "fire_facility_general"
};

function normalizeImage(image) {
  const localPath = image.local_path || null;
  const storagePath = localPath
    ? localPath.replaceAll("\\", "/").replace(
        "data/raw/cbtbank/images/",
        "fire/raw/images/"
      )
    : null;

  return {
    url: image.url || null,
    alt: image.alt || null,
    local_path: localPath,
    storage_path: storagePath
  };
}

function toRuntimeQuestion(exam, question) {
  const subjectId = subjectIds[question.subject] || "fire_facility_electric";
  return {
    id: question.id,
    source: {
      examDate: exam.date,
      examName: `${question.subject} 기출문제`,
      questionNumber: question.number,
      provider: exam.source?.provider || "CBTBank",
      sourceUrl: question.source_url || exam.source?.url || null
    },
    subjectId,
    chapterId: chapterIds[subjectId],
    type: "multiple_choice",
    difficulty:
      typeof question.correct_rate !== "number"
        ? "basic"
        : question.correct_rate >= 80
          ? "easy"
          : question.correct_rate >= 60
            ? "basic"
            : question.correct_rate >= 40
              ? "intermediate"
              : "advanced",
    question: question.question,
    choices: (question.choices || []).map((text, index) => ({
      number: index + 1,
      text
    })),
    answer: question.answer,
    explanation: question.explanation,
    tags: [...new Set([subjectId, question.subject, "CBTBank", ...(question.tags || [])])],
    images: (question.images || []).map(normalizeImage),
    importMeta: {
      originalId: question.id,
      originalExam: exam.exam,
      originalSubject: question.subject,
      answerText: question.answer_text || null,
      correctRate: question.correct_rate ?? null,
      importedFrom: "CBTBank raw"
    }
  };
}

async function main() {
  const files = (await readdir(rawDir))
    .filter((file) => file.endsWith(".json"))
    .sort();
  const questions = [];

  for (const file of files) {
    const exam = JSON.parse(await readFile(path.join(rawDir, file), "utf8"));
    questions.push(...(exam.questions || []).map((question) => toRuntimeQuestion(exam, question)));
  }

  const ids = new Set();
  const duplicates = [];
  for (const question of questions) {
    if (ids.has(question.id)) duplicates.push(question.id);
    ids.add(question.id);
  }
  if (duplicates.length) {
    throw new Error(`Duplicate question IDs: ${duplicates.join(", ")}`);
  }

  await writeFile(outputPath, `${JSON.stringify(questions, null, 2)}\n`, "utf8");
  const imageRefs = questions.flatMap((question) => question.images);
  console.log(JSON.stringify({
    examFiles: files.length,
    questions: questions.length,
    questionsWithImages: questions.filter((question) => question.images.length).length,
    imageReferences: imageRefs.length,
    outputPath
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
