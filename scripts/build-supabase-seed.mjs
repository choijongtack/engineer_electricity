import path from "node:path";
import {
  fileExists,
  learningDir,
  loadContentFiles,
  normalizeSubjectId,
  readJson,
  seedDir,
  unique,
  writeJson
} from "./data-pipeline-utils.mjs";

async function main() {
  const sourceDir = process.argv[2] ? path.resolve(process.argv[2]) : learningDir;
  const schema = await readJson(path.join(sourceDir, "01_schema_meta.json"));
  const contents = await loadContentFiles(sourceDir);
  const questions = await readJson(path.join(sourceDir, "11_questions_past_exam.json"));
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

  const subjects = (schema.subjects || []).map((subject, index) => ({
    id: normalizeSubjectId(subject.name || subject.code),
    code: subject.code || null,
    name: subject.name,
    sort_order: index + 1
  }));

  await writeJson(path.join(seedDir, "subjects.seed.json"), subjects);
  await writeJson(
    path.join(seedDir, "contents.seed.json"),
    contents.map((content) => ({
      ...content,
      subject_id: normalizeSubjectId(content.subject)
    }))
  );
  await writeJson(
    path.join(seedDir, "questions.seed.json"),
    questions.map((question) => ({
      ...question,
      subject_id: normalizeSubjectId(question.subject)
    }))
  );
  await writeJson(path.join(seedDir, "content_question_map.seed.json"), mapItems);
  await writeJson(path.join(seedDir, "memory_cards.seed.json"), memoryCards);
  await writeJson(path.join(seedDir, "blank_quizzes.seed.json"), blankQuizzes);
  await writeJson(path.join(seedDir, "exam_sets.seed.json"), examSets);
  await writeJson(
    path.join(seedDir, "review_flags.seed.json"),
    questions
      .filter((question) => question.needs_review)
      .map((question) => ({
        question_id: question.question_id,
        subject_id: normalizeSubjectId(question.subject),
        review_reason: question.review_reason || null
      }))
  );

  console.log(
    JSON.stringify(
      {
        seedDir,
        subjects: subjects.length,
        contents: contents.length,
        questions: questions.length,
        mappings: mapItems.length,
        memoryCards: memoryCards.length,
        blankQuizzes: blankQuizzes.length,
        examSets: examSets.length,
        reviewFlags: questions.filter((question) => question.needs_review).length
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
