import path from "node:path";
import {
  dataRoot,
  fileExists,
  learningDir,
  loadContentFiles,
  readJson,
  unique
} from "./data-pipeline-utils.mjs";

async function main() {
  const sourceDir = process.argv[2] ? path.resolve(process.argv[2]) : learningDir;
  const contents = await loadContentFiles(sourceDir);
  const questions = await readJson(path.join(sourceDir, "11_questions_past_exam.json"));
  const runtimeQuestions = await readJson(path.join(dataRoot, "fire_questions.json"));
  const learningPaths = await readJson(path.join(sourceDir, "02_learning_paths.json"));
  const mapItems = (await fileExists(path.join(sourceDir, "12_content_question_map.json")))
    ? await readJson(path.join(sourceDir, "12_content_question_map.json"))
    : [];
  const memoryCards = (await fileExists(path.join(sourceDir, "30_memory_cards.json")))
    ? await readJson(path.join(sourceDir, "30_memory_cards.json"))
    : [];
  const blankQuizzes = (await fileExists(path.join(sourceDir, "31_blank_quizzes.json")))
    ? await readJson(path.join(sourceDir, "31_blank_quizzes.json"))
    : [];
  const examSets = (await fileExists(path.join(sourceDir, "32_exam_sets.json")))
    ? await readJson(path.join(sourceDir, "32_exam_sets.json"))
    : [];

  const questionIds = questions.map((question) => question.question_id);
  const contentIds = contents.map((content) => content.content_id);

  const report = {
    generated_at: new Date().toISOString(),
    status: "PASS",
    counts: {
      contents: contents.length,
      questions: questions.length,
      learning_paths: learningPaths.length,
      content_question_map: mapItems.length,
      memory_cards: memoryCards.length,
      blank_quizzes: blankQuizzes.length,
      exam_sets: examSets.length
    },
    errors: []
  };

  pushDuplicates(report.errors, "duplicate question_id", findDuplicates(questionIds));
  pushDuplicates(report.errors, "duplicate content_id", findDuplicates(contentIds));

  const contentIdSet = new Set(contentIds);
  const questionIdSet = new Set(questionIds);
  const runtimeQuestionIdSet = new Set(runtimeQuestions.map((question) => question.id));
  const pathQuestionIdSet = new Set([...questionIdSet, ...runtimeQuestionIdSet]);

  for (const item of mapItems) {
    if (!contentIdSet.has(item.content_id)) {
      report.errors.push(`missing content for map: ${item.content_id}`);
    }
    if (!questionIdSet.has(item.question_id)) {
      report.errors.push(`missing question for map: ${item.question_id}`);
    }
  }

  for (const pathItem of learningPaths) {
    for (const contentId of pathItem.content_ids || []) {
      if (!contentIdSet.has(contentId)) {
        report.errors.push(`missing content for learning path day ${pathItem.day_no}: ${contentId}`);
      }
    }
    for (const questionId of pathItem.question_ids || []) {
      if (!pathQuestionIdSet.has(questionId)) {
        report.errors.push(`missing question for learning path day ${pathItem.day_no}: ${questionId}`);
      }
    }
  }

  if (report.errors.length > 0) {
    report.status = "FAIL";
  }

  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.status === "PASS" ? 0 : 1;
}

function findDuplicates(values) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) {
    if (!value) {
      continue;
    }
    if (seen.has(value)) {
      duplicates.add(value);
    } else {
      seen.add(value);
    }
  }
  return unique([...duplicates]);
}

function pushDuplicates(target, label, duplicates) {
  for (const duplicate of duplicates) {
    target.push(`${label}: ${duplicate}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
