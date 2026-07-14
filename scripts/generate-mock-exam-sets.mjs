import fs from "node:fs";

const questions = JSON.parse(fs.readFileSync("data/fire_questions.json", "utf8"));
const subjects = ["fire_theory", "electric_circuit", "fire_law", "fire_facility_electric"];

function shuffle(items, seed) {
  const result = [...items];
  let value = seed;
  for (let i = result.length - 1; i > 0; i -= 1) {
    value = (value * 9301 + 49297) % 233280;
    const j = Math.floor((value / 233280) * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

const sets = Array.from({ length: 10 }, (_, index) => {
  const questionIds = subjects.flatMap((subjectId, subjectIndex) => {
    const pool = questions.filter((question) => question.subjectId === subjectId);
    const mixed = shuffle(pool, 20260714 + index * 97 + subjectIndex * 31);
    return mixed.slice(0, 20).map((question) => question.id);
  });
  return {
    id: `mock_set_${String(index + 1).padStart(2, "0")}`,
    title: `기출 혼합 모의고사 ${index + 1}회`,
    durationMinutes: 80,
    questionIds: shuffle(questionIds, 4000 + index)
  };
});

fs.writeFileSync("data/fire_mock-exam.json", `${JSON.stringify(sets, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ sets: sets.length, questionsPerSet: sets[0].questionIds.length }, null, 2));
