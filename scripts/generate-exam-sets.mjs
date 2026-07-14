import path from "node:path";
import { learningDir, readJson, unique, writeJson } from "./data-pipeline-utils.mjs";

const SCHEMA_VERSION = "2.0-compatible-v1";
const MOCK_EXAM_SET_COUNT = 10;
const OUTPUT_PATH = path.join(learningDir, "32_exam_sets.json");

async function main() {
  const questions = await readJson(path.join(learningDir, "11_questions_past_exam.json"));
  const reportPath = path.join(learningDir, "validation_report.json");

  const byDate = new Map();
  for (const question of questions) {
    const current = byDate.get(question.source_date) || [];
    current.push(question);
    byDate.set(question.source_date, current);
  }

  const selectedDates = [...byDate.keys()]
    .sort((left, right) => right.localeCompare(left))
    .slice(0, MOCK_EXAM_SET_COUNT);
  if (selectedDates.length < MOCK_EXAM_SET_COUNT) {
    throw new Error(`모의고사 생성을 위해 최소 ${MOCK_EXAM_SET_COUNT}개 기출 회차가 필요합니다.`);
  }
  const examSets = selectedDates.map((date, index) => buildExamSet(byDate.get(date) || [], index + 1));

  await writeJson(OUTPUT_PATH, examSets);

  const report = await readJson(reportPath);
  report.exam_sets_count = examSets.length;
  await writeJson(reportPath, report);

  console.log(
    JSON.stringify(
      {
        examSetCount: examSets.length,
        dates: examSets.map((item) => ({ exam_set_id: item.exam_set_id, source_date: item.source_date, question_count: item.question_ids.length }))
      },
      null,
      2
    )
  );
}

function buildExamSet(questions, setNo) {
  const sorted = [...questions].sort((left, right) => left.source_question_no - right.source_question_no);
  const questionIds = sorted.map((item) => item.question_id);
  const subjectSummary = {};
  for (const item of sorted) {
    subjectSummary[item.subject] ||= 0;
    subjectSummary[item.subject] += 1;
  }

  return {
    schema_version: SCHEMA_VERSION,
    exam_set_id: `MOCK_SET_${String(setNo).padStart(2, "0")}`,
    set_no: setNo,
    title: `${sorted[0]?.source_date || ""} 기출 모의고사`,
    description: "실제 기출 1회차 80문항을 그대로 재구성한 모의고사 세트",
    source_type: "past_exam_round",
    source_date: sorted[0]?.source_date || null,
    question_count: questionIds.length,
    duration_minutes: 80,
    question_ids: questionIds,
    subject_distribution: Object.entries(subjectSummary).map(([subject, count]) => ({ subject, count })),
    tags: unique(["past_exam", "80_questions", "4_subjects", sorted[0]?.source_date || ""]),
    status: "published"
  };
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
