import path from "node:path";
import {
  buildReviewFlags,
  copyDirectoryContents,
  defaultCbtIndexPath,
  defaultLearningSourceDir,
  defaultProcessedExamsDir,
  ensureDir,
  fileExists,
  learningDir,
  listJsonFiles,
  loadContentFiles,
  normalizeSubjectId,
  rawCbtbankDir,
  readJson,
  sortByLearningOrder,
  unique,
  writeJson
} from "./data-pipeline-utils.mjs";

const knownLearningFiles = [
  "01_schema_meta.json",
  "02_learning_paths.json",
  "12_content_question_map.json",
  "30_memory_cards.json",
  "31_blank_quizzes.json",
  "32_exam_sets.json"
];

async function main() {
  const options = parseArgs(process.argv.slice(2));

  await ensureDir(rawCbtbankDir);
  await ensureDir(learningDir);

  const selectedExamIds = await resolveSelectedExamIds(options);
  await copyRawExamFiles(selectedExamIds, options.processedExamsDir);
  await copyStaticLearningFiles(options.learningSourceDir);

  const questions = await buildQuestionsFromRaw(selectedExamIds, options);
  await writeJson(path.join(learningDir, "11_questions_past_exam.json"), questions);

  const validationReport = await buildValidationReport(selectedExamIds);
  await writeJson(path.join(learningDir, "validation_report.json"), validationReport);

  console.log(
    JSON.stringify(
      {
        selectedExamIds,
        rawOutputDir: rawCbtbankDir,
        learningOutputDir: learningDir,
        questionCount: questions.length,
        validation: validationReport.status
      },
      null,
      2
    )
  );
}

function parseArgs(argv) {
  const options = {
    learningSourceDir: defaultLearningSourceDir,
    cbtIndexPath: defaultCbtIndexPath,
    processedExamsDir: defaultProcessedExamsDir,
    latestCount: null,
    examIds: []
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const nextValue = argv[index + 1];

    if (arg === "--learning-source") {
      options.learningSourceDir = path.resolve(nextValue);
      index += 1;
      continue;
    }

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

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

async function resolveSelectedExamIds(options) {
  if (options.examIds.length > 0) {
    return unique(options.examIds);
  }

  const learningQuestionsPath = path.join(options.learningSourceDir, "11_questions_past_exam.json");
  if (await fileExists(learningQuestionsPath)) {
    const existingQuestions = await readJson(learningQuestionsPath);
    const examIds = unique(
      existingQuestions.map((question) => `fire_electric_${String(question.source_date || "").replaceAll("-", "")}`)
    );
    if (examIds.length > 0) {
      return examIds.sort();
    }
  }

  const index = await readJson(options.cbtIndexPath);
  const selected = options.latestCount ? index.slice(0, options.latestCount) : index.slice(0, 25);
  return selected.map((entry) => entry.exam_id);
}

async function copyRawExamFiles(selectedExamIds, processedExamsDir) {
  await Promise.all(
    selectedExamIds.map(async (examId) => {
      const sourcePath = path.join(processedExamsDir, `${examId}.json`);
      const targetPath = path.join(rawCbtbankDir, `${examId}.json`);
      if (!(await fileExists(sourcePath))) {
        throw new Error(`Missing raw exam file: ${sourcePath}`);
      }
      await copyDirectoryContents(path.dirname(sourcePath), path.dirname(targetPath), [`${examId}.json`]);
    })
  );
}

async function copyStaticLearningFiles(sourceDir) {
  const files = await listJsonFiles(sourceDir);
  const contentFiles = files.filter((file) => /^\d+_contents_.*\.json$/i.test(file));
  const passThroughFiles = [...knownLearningFiles, ...contentFiles];
  await copyDirectoryContents(sourceDir, learningDir, passThroughFiles);
}

async function buildQuestionsFromRaw(selectedExamIds, options) {
  const sourceDir = options.learningSourceDir;
  const contents = sortByLearningOrder(await loadContentFiles(sourceDir));
  const contentMapPath = path.join(sourceDir, "12_content_question_map.json");
  const mapItems = (await fileExists(contentMapPath)) ? await readJson(contentMapPath) : [];
  const contentById = new Map(contents.map((content) => [content.content_id, content]));
  const mappedContentByQuestionId = new Map();

  for (const item of mapItems) {
    const content = contentById.get(item.content_id);
    if (content && !mappedContentByQuestionId.has(item.question_id)) {
      mappedContentByQuestionId.set(item.question_id, content);
    }
  }

  const questions = [];
  for (const examId of selectedExamIds) {
    const exam = await readJson(path.join(rawCbtbankDir, `${examId}.json`));
    for (const question of exam.questions) {
      const mappedContent = mappedContentByQuestionId.get(question.id) || null;
      const review = buildReviewFlags({
        question_text: question.question,
        explanation: question.explanation,
        answer_text: question.answer_text,
        images: question.images,
        subject: question.subject
      });

      questions.push({
        schema_version: "2.0-compatible-v1",
        original_id: question.id,
        question_id: question.id,
        source_type: "past_exam",
        source_date: exam.date,
        source_question_no: question.number,
        subject: question.subject,
        chapter: mappedContent?.chapter || question.subject,
        topic: mappedContent?.topic || "미분류",
        exam_point: mappedContent?.memory_point || mappedContent?.title || "기출 핵심 정리 필요",
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
        needs_review: review.needsReview,
        review_reason: review.reviewReason || null,
        tags: unique([
          question.subject,
          mappedContent?.chapter,
          mappedContent?.topic,
          ...(question.tags || [])
        ]),
        status: "published"
      });
    }
  }

  return questions.sort((left, right) => left.question_id.localeCompare(right.question_id));
}

async function buildValidationReport(selectedExamIds) {
  const questions = await readJson(path.join(learningDir, "11_questions_past_exam.json"));
  const mapItems = (await fileExists(path.join(learningDir, "12_content_question_map.json")))
    ? await readJson(path.join(learningDir, "12_content_question_map.json"))
    : [];
  const learningPaths = (await fileExists(path.join(learningDir, "02_learning_paths.json")))
    ? await readJson(path.join(learningDir, "02_learning_paths.json"))
    : [];
  const contents = await loadContentFiles(learningDir);
  const questionIds = new Set(questions.map((question) => question.question_id));
  const contentIds = new Set(contents.map((content) => content.content_id));

  const missingMapQuestions = mapItems.filter((item) => !questionIds.has(item.question_id)).map((item) => item.question_id);
  const missingMapContents = mapItems.filter((item) => !contentIds.has(item.content_id)).map((item) => item.content_id);
  const missingPathQuestions = learningPaths.flatMap((pathItem) =>
    (pathItem.question_ids || []).filter((questionId) => !questionIds.has(questionId))
  );
  const missingPathContents = learningPaths.flatMap((pathItem) =>
    (pathItem.content_ids || []).filter((contentId) => !contentIds.has(contentId))
  );

  return {
    generated_at: new Date().toISOString(),
    status:
      missingMapQuestions.length || missingMapContents.length || missingPathQuestions.length || missingPathContents.length
        ? "WARN"
        : "PASS",
    selected_exam_count: selectedExamIds.length,
    selected_question_count: questions.length,
    content_count: contents.length,
    content_question_map_count: mapItems.length,
    learning_path_count: learningPaths.length,
    missing_map_question_ids: unique(missingMapQuestions),
    missing_map_content_ids: unique(missingMapContents),
    missing_path_question_ids: unique(missingPathQuestions),
    missing_path_content_ids: unique(missingPathContents)
  };
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
