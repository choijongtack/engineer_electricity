import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const rawDir = path.resolve("data/raw/cbtbank");
const targetPath = path.resolve("data/fire_questions.json");
const rawFiles = (await readdir(rawDir)).filter((file) => file.endsWith(".json"));
const explanations = new Map();

for (const file of rawFiles) {
  const exam = JSON.parse(await readFile(path.join(rawDir, file), "utf8"));
  for (const question of exam.questions || []) {
    explanations.set(question.id, question.explanation);
  }
}

const questions = JSON.parse(await readFile(targetPath, "utf8"));
let updated = 0;
for (const question of questions) {
  const explanation = explanations.get(question.importMeta?.originalId || question.id);
  if (typeof explanation === "string" && explanation !== question.explanation) {
    question.explanation = explanation;
    updated += 1;
  }
}

await writeFile(targetPath, `${JSON.stringify(questions, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ rawFiles: rawFiles.length, questions: questions.length, updated }, null, 2));
