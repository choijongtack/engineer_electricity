import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_CBT_DATA_DIR = path.resolve("..", "소방설비전기기사_CBT", "data");
const DEFAULT_INDEX_PATH = path.join(DEFAULT_CBT_DATA_DIR, "index.json");
const DEFAULT_EXAMS_DIR = path.join(DEFAULT_CBT_DATA_DIR, "processed", "exams");
const DEFAULT_EXISTING_QUESTIONS_PATH = path.resolve("data", "fire_questions.json");
const DEFAULT_CBTBANK_ONLY_OUTPUT_PATH = path.resolve("data", "questions.cbtbank.json");
const DEFAULT_MERGED_OUTPUT_PATH = path.resolve("data", "questions.merged.json");

const SUBJECT_ID_BY_NAME = {
  소방원론: "fire_theory",
  소방전기회로: "electric_circuit",
  소방관계법규: "fire_law",
  "소방전기시설의 구조 및 원리": "fire_facility_electric"
};

const SUBJECT_ID_BY_QUESTION_NUMBER = [
  { max: 20, subjectId: "fire_theory" },
  { max: 40, subjectId: "electric_circuit" },
  { max: 60, subjectId: "fire_law" },
  { max: 80, subjectId: "fire_facility_electric" }
];

const DEFAULT_CHAPTER_BY_SUBJECT_ID = {
  fire_theory: "fire_theory_general",
  electric_circuit: "electric_circuit_general",
  fire_law: "fire_law_general",
  fire_facility_electric: "fire_facility_general"
};

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const index = JSON.parse(await readFile(options.indexPath, "utf8"));
  const existingQuestions = options.skipMerge
    ? []
    : JSON.parse(await readFile(options.existingQuestionsPath, "utf8"));

  const selectedEntries = selectEntries(index, options);
  const importedQuestions = [];

  for (const entry of selectedEntries) {
    const examFilePath = path.join(options.examsDir, `${entry.exam_id}.json`);
    const examFile = JSON.parse(await readFile(examFilePath, "utf8"));
    importedQuestions.push(...examFile.questions.map((question) => toAppQuestion(examFile, question)));
  }

  const sortedImportedQuestions = sortQuestions(importedQuestions);
  const overlappingIds = findOverlappingIds(existingQuestions, importedQuestions);
  const mergedQuestions = options.skipMerge
    ? sortedImportedQuestions
    : sortQuestions(mergeQuestions(importedQuestions, existingQuestions));

  await ensureDir(path.dirname(options.cbtbankOnlyOutputPath));
  await writeJson(options.cbtbankOnlyOutputPath, sortedImportedQuestions);
  await writeJson(options.mergedOutputPath, mergedQuestions);

  if (options.appOutputPath) {
    await writeJson(options.appOutputPath, sortedImportedQuestions);
  }

  console.log(
    JSON.stringify(
      {
        importedExamCount: selectedEntries.length,
        importedQuestionCount: sortedImportedQuestions.length,
        existingQuestionCount: existingQuestions.length,
        overlappingQuestionCount: overlappingIds.length,
        firstImportedExamId: selectedEntries[0]?.exam_id || null,
        lastImportedExamId: selectedEntries.at(-1)?.exam_id || null,
        cbtbankOnlyOutput: relativeFromCwd(options.cbtbankOnlyOutputPath),
        mergedOutput: relativeFromCwd(options.mergedOutputPath),
        appOutput: options.appOutputPath ? relativeFromCwd(options.appOutputPath) : null
      },
      null,
      2
    )
  );
}

function parseArgs(argv) {
  const options = {
    indexPath: DEFAULT_INDEX_PATH,
    examsDir: DEFAULT_EXAMS_DIR,
    existingQuestionsPath: DEFAULT_EXISTING_QUESTIONS_PATH,
    cbtbankOnlyOutputPath: DEFAULT_CBTBANK_ONLY_OUTPUT_PATH,
    mergedOutputPath: DEFAULT_MERGED_OUTPUT_PATH,
    appOutputPath: null,
    examIds: [],
    latestCount: null,
    skipMerge: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--exam-id") {
      const value = argv[index + 1];
      assertValue(arg, value);
      options.examIds.push(value);
      index += 1;
      continue;
    }

    if (arg === "--latest-count") {
      const value = argv[index + 1];
      assertValue(arg, value);
      options.latestCount = Number.parseInt(value, 10);
      if (!Number.isInteger(options.latestCount) || options.latestCount <= 0) {
        throw new Error("--latest-count must be a positive integer.");
      }
      index += 1;
      continue;
    }

    if (arg === "--cbt-data-dir") {
      const value = argv[index + 1];
      assertValue(arg, value);
      const resolved = path.resolve(value);
      options.indexPath = path.join(resolved, "index.json");
      options.examsDir = path.join(resolved, "processed", "exams");
      index += 1;
      continue;
    }

    if (arg === "--existing-questions") {
      const value = argv[index + 1];
      assertValue(arg, value);
      options.existingQuestionsPath = path.resolve(value);
      index += 1;
      continue;
    }

    if (arg === "--output") {
      const value = argv[index + 1];
      assertValue(arg, value);
      options.cbtbankOnlyOutputPath = path.resolve(value);
      index += 1;
      continue;
    }

    if (arg === "--merged-output") {
      const value = argv[index + 1];
      assertValue(arg, value);
      options.mergedOutputPath = path.resolve(value);
      index += 1;
      continue;
    }

    if (arg === "--app-output") {
      const value = argv[index + 1];
      assertValue(arg, value);
      options.appOutputPath = path.resolve(value);
      index += 1;
      continue;
    }

    if (arg === "--skip-merge") {
      options.skipMerge = true;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function assertValue(flag, value) {
  if (!value) {
    throw new Error(`${flag} requires a value.`);
  }
}

function selectEntries(index, options) {
  let entries = [...index];

  if (options.examIds.length > 0) {
    const wanted = new Set(options.examIds);
    entries = entries.filter((entry) => wanted.has(entry.exam_id));
  }

  if (options.latestCount) {
    entries = entries.slice(0, options.latestCount);
  }

  return entries;
}

function toAppQuestion(examFile, question) {
  const subjectId = inferSubjectId(question);
  const chapterId = DEFAULT_CHAPTER_BY_SUBJECT_ID[subjectId];
  const examDateCompact = examFile.date.replaceAll("-", "");
  const questionId = question.id || `Q_${examDateCompact}_${String(question.number).padStart(3, "0")}`;

  return {
    id: questionId,
    source: {
      examDate: examFile.date,
      examName: `${question.subject} 기출문제`,
      questionNumber: question.number,
      provider: examFile.source.provider,
      sourceUrl: question.source_url
    },
    subjectId,
    chapterId,
    type: "multiple_choice",
    difficulty: toDifficulty(question.correct_rate),
    question: question.question,
    choices: question.choices.map((choice, index) => ({
      number: index + 1,
      text: choice
    })),
    answer: question.answer,
    explanation: question.explanation,
    tags: buildTags(question, chapterId),
    images: Array.isArray(question.images) ? question.images : [],
    importMeta: {
      originalId: question.id ?? null,
      originalExam: examFile.exam,
      originalSubject: question.subject,
      answerText: question.answer_text ?? null,
      correctRate: question.correct_rate ?? null,
      importedFrom: "CBTBank"
    }
  };
}

function inferSubjectId(question) {
  const directMatch = SUBJECT_ID_BY_NAME[question.subject];
  if (directMatch) {
    return directMatch;
  }

  const fallback = SUBJECT_ID_BY_QUESTION_NUMBER.find((item) => question.number <= item.max);
  if (fallback) {
    return fallback.subjectId;
  }

  throw new Error(`Unsupported subject mapping: ${question.subject}`);
}

function toDifficulty(correctRate) {
  if (typeof correctRate !== "number") {
    return "basic";
  }
  if (correctRate >= 80) {
    return "easy";
  }
  if (correctRate >= 60) {
    return "basic";
  }
  if (correctRate >= 40) {
    return "intermediate";
  }
  return "advanced";
}

function buildTags(question, chapterId) {
  const tags = new Set([chapterId, question.subject, "CBTBank"]);
  for (const tag of question.tags ?? []) {
    if (typeof tag === "string" && tag.trim()) {
      tags.add(tag.trim());
    }
  }
  return [...tags];
}

function findOverlappingIds(existingQuestions, importedQuestions) {
  const existingIds = new Set(existingQuestions.map(getQuestionIdentity));
  return importedQuestions
    .map((question) => getQuestionIdentity(question))
    .filter((id) => existingIds.has(id))
    .sort();
}

function mergeQuestions(primary, secondary) {
  const merged = new Map();

  for (const question of secondary) {
    merged.set(getQuestionIdentity(question), question);
  }

  for (const question of primary) {
    merged.set(getQuestionIdentity(question), question);
  }

  return [...merged.values()];
}

function getQuestionIdentity(question) {
  return question?.importMeta?.originalId || question?.id;
}

function sortQuestions(questions) {
  return [...questions].sort((left, right) => left.id.localeCompare(right.id));
}

async function writeJson(targetPath, value) {
  await writeFile(targetPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function ensureDir(targetPath) {
  await mkdir(targetPath, { recursive: true });
}

function relativeFromCwd(targetPath) {
  return path.relative(process.cwd(), targetPath).replaceAll("\\", "/");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
