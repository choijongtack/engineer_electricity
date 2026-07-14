import { rm } from "node:fs/promises";
import path from "node:path";
import {
  appDataDir,
  defaultCbtIndexPath,
  defaultProcessedExamsDir,
  ensureDir,
  fileExists,
  learningDir,
  rawCbtbankDir,
  readJson,
  seedDir,
  unique,
  writeJson
} from "./data-pipeline-utils.mjs";

const appRuntimeFiles = ["fire_subjects.json", "fire_lessons.json", "fire_questions.json", "fire_mock-exam.json"];

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const selectedEntries = await selectExamEntries(options);

  await resetDirectory(learningDir);
  await resetDirectory(seedDir);

  if (options.resetAppRuntime) {
    await removeAppRuntimeFiles();
  }

  await ensureDir(learningDir);
  await ensureDir(seedDir);
  await ensureDir(rawCbtbankDir);

  await writeJson(path.join(learningDir, "01_schema_meta.json"), buildSchemaMeta(selectedEntries));
  await writeJson(path.join(learningDir, "02_learning_paths.json"), []);
  await writeJson(path.join(learningDir, "03_contents_fire_basic.json"), []);
  await writeJson(path.join(learningDir, "04_contents_fire_extinguishing.json"), []);
  await writeJson(path.join(learningDir, "05_contents_fire_hazard_evacuation.json"), []);
  await writeJson(path.join(learningDir, "06_contents_electric_basic.json"), []);
  await writeJson(path.join(learningDir, "07_contents_electric_control.json"), []);
  await writeJson(path.join(learningDir, "08_contents_law.json"), []);
  await writeJson(path.join(learningDir, "09_contents_facility_alarm.json"), []);
  await writeJson(path.join(learningDir, "10_contents_facility_evac_power.json"), []);

  const questions = await buildV2Questions(selectedEntries, options.processedExamsDir);
  await writeJson(path.join(learningDir, "11_questions_past_exam.json"), questions);
  await writeJson(path.join(learningDir, "12_content_question_map.json"), []);
  await writeJson(path.join(learningDir, "30_memory_cards.json"), []);
  await writeJson(path.join(learningDir, "31_blank_quizzes.json"), []);
  await writeJson(path.join(learningDir, "32_exam_sets.json"), []);
  await writeJson(path.join(learningDir, "validation_report.json"), buildInitialValidationReport(selectedEntries, questions));

  console.log(
    JSON.stringify(
      {
        resetAppRuntime: options.resetAppRuntime,
        examCount: selectedEntries.length,
        questionCount: questions.length,
        learningDir,
        seedDir,
        note: "questions regenerated from raw; learning contents/mappings/cards/paths reset to empty placeholders"
      },
      null,
      2
    )
  );
}

function parseArgs(argv) {
  const options = {
    cbtIndexPath: defaultCbtIndexPath,
    processedExamsDir: defaultProcessedExamsDir,
    latestCount: 25,
    examIds: [],
    resetAppRuntime: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const nextValue = argv[index + 1];

    if (arg === "--cbt-index") {
      options.cbtIndexPath = path.resolve(nextValue);
      index += 1;
      continue;
    }

    if (arg === "--processed-exams-dir") {
      options.processedExamsDir = path.resolve(nextValue);
      index += 1;
      continue;
    }

    if (arg === "--latest-count") {
      options.latestCount = Number.parseInt(nextValue, 10);
      index += 1;
      continue;
    }

    if (arg === "--exam-id") {
      options.examIds.push(nextValue);
      index += 1;
      continue;
    }

    if (arg === "--reset-app-runtime") {
      options.resetAppRuntime = true;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

async function selectExamEntries(options) {
  const index = await readJson(options.cbtIndexPath);
  if (options.examIds.length > 0) {
    const wanted = new Set(options.examIds);
    return index.filter((entry) => wanted.has(entry.exam_id));
  }
  return index.slice(0, options.latestCount);
}

async function resetDirectory(targetPath) {
  if (await fileExists(targetPath)) {
    await rm(targetPath, { recursive: true, force: true });
  }
}

async function removeAppRuntimeFiles() {
  await Promise.all(
    appRuntimeFiles.map(async (fileName) => {
      const filePath = path.join(appDataDir, fileName);
      if (await fileExists(filePath)) {
        await rm(filePath, { force: true });
      }
    })
  );
}

function buildSchemaMeta(selectedEntries) {
  return {
    package_id: "FIRE_ELECTRIC_ENGINEER_JSON_V2_CLEAN_SLATE",
    package_title: "소방설비기사 전기분야 학습앱 V2 호환 학습 데이터",
    created_at: new Date().toISOString(),
    source_basis: {
      type: "raw_cbtbank_json",
      source_exam_files: selectedEntries.length,
      source_questions_total: selectedEntries.reduce((sum, entry) => sum + Number(entry.question_count || 0), 0),
      batch_scope: "clean_slate_rebuild"
    },
    subjects: [
      { code: "FIRE_THEORY", name: "소방원론" },
      { code: "ELECTRIC_CIRCUIT", name: "소방전기회로" },
      { code: "FIRE_LAW", name: "소방관계법규" },
      { code: "ELECTRIC_FACILITY", name: "소방전기시설의 구조 및 원리" }
    ],
    content_schema: {
      required: [
        "content_id",
        "subject",
        "chapter",
        "topic",
        "level",
        "learning_order",
        "title",
        "learning_goal",
        "concept_core",
        "concept_easy",
        "memory_point",
        "summary",
        "status"
      ],
      levels: ["beginner", "basic", "intermediate"],
      status_values: ["draft", "reviewed", "published"]
    },
    question_schema: {
      required: [
        "question_id",
        "source_type",
        "source_date",
        "source_question_no",
        "subject",
        "chapter",
        "topic",
        "question_type",
        "question_text",
        "choices",
        "answer",
        "explanation",
        "status"
      ],
      question_types: ["multiple_choice", "blank", "true_false"],
      status_values: ["draft", "reviewed", "published"]
    },
    schema_version: "2.0-compatible-v1",
    notes: [
      "This package was reset from raw exam JSON only.",
      "Learning contents, mappings, memory cards, blank quizzes, and exam sets must be recreated sequentially."
    ]
  };
}

async function buildV2Questions(selectedEntries, processedExamsDir) {
  const questions = [];

  for (const entry of selectedEntries) {
    const exam = await readJson(path.join(processedExamsDir, `${entry.exam_id}.json`));
    for (const question of exam.questions) {
      questions.push({
        schema_version: "2.0-compatible-v1",
        original_id: question.id,
        question_id: question.id,
        source_type: "past_exam",
        source_date: exam.date,
        source_question_no: question.number,
        subject: question.subject,
        chapter: "미분류",
        topic: "미분류",
        exam_point: "분류 필요",
        question_type: "multiple_choice",
        question_text: question.question,
        choices: question.choices.map((choice, index) => ({
          choice_no: index + 1,
          choice_text: choice
        })),
        answer: question.answer,
        answer_text: question.answer_text ?? null,
        explanation: question.explanation,
        correct_rate: question.correct_rate ?? null,
        images: Array.isArray(question.images) ? question.images : [],
        source_url: question.source_url || exam.source?.url || null,
        needs_review: inferNeedsReview(question),
        review_reason: buildReviewReason(question),
        tags: unique([question.subject, ...(question.tags || [])]),
        status: "published"
      });
    }
  }

  return questions.sort((left, right) => left.question_id.localeCompare(right.question_id));
}

function inferNeedsReview(question) {
  return Boolean(
    question.subject === "소방관계법규" ||
      (Array.isArray(question.images) && question.images.length > 0) ||
      /(개정|법령|기준|규정|nfsc|시행령|시행규칙|mm|cm|m2|m3|lx|kg|%|℃)/i.test(
        `${question.question} ${question.explanation} ${question.answer_text || ""}`
      )
  );
}

function buildReviewReason(question) {
  const reasons = [];
  if (question.subject === "소방관계법규") {
    reasons.push("law_subject");
  }
  if (Array.isArray(question.images) && question.images.length > 0) {
    reasons.push("has_image");
  }
  if (/(개정|법령|기준|규정|nfsc|시행령|시행규칙)/i.test(`${question.question} ${question.explanation}`)) {
    reasons.push("regulation_or_revision_risk");
  }
  if (/(mm|cm|m2|m3|lx|kg|%|℃)/i.test(`${question.question} ${question.explanation}`)) {
    reasons.push("numeric_or_unit_risk");
  }
  return reasons.length ? unique(reasons).join(", ") : null;
}

function buildInitialValidationReport(selectedEntries, questions) {
  return {
    generated_at: new Date().toISOString(),
    status: "WARN",
    selected_exam_count: selectedEntries.length,
    selected_question_count: questions.length,
    content_count: 0,
    content_question_map_count: 0,
    learning_path_count: 0,
    memory_cards_count: 0,
    blank_quizzes_count: 0,
    exam_sets_count: 0,
    pending_steps: [
      "contents generation",
      "content-question mapping generation",
      "memory card generation",
      "blank quiz generation",
      "learning path generation",
      "exam set generation"
    ]
  };
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
