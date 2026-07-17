import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const inputPath = path.join(root, "data", "fire_questions.json");
const outputPath = path.join(root, "data", "question_relations.json");
const SIMILAR_THRESHOLD = 0.85;
const RELATED_THRESHOLD = 0.65;
const MAX_RELATED_PER_QUESTION = 8;

const questions = JSON.parse(await readFile(inputPath, "utf8"));
const normalized = questions.map(toComparableQuestion);
const exactGroups = groupBy(normalized, (item) => item.exactKey);
const relations = [];
const relationKeys = new Set();

for (const group of exactGroups.values()) {
  if (group.length < 2) continue;
  for (let i = 0; i < group.length; i += 1) {
    for (let j = i + 1; j < group.length; j += 1) {
      addRelation(group[i], group[j], "exact", 1, {
        question_text_similarity: 1,
        choice_similarity: 1,
        answer_same: group[i].answer === group[j].answer,
        subject_same: group[i].subjectId === group[j].subjectId
      });
    }
  }
}

const tokenIndex = new Map();
for (const item of normalized) {
  for (const token of item.tokens) {
    const bucket = tokenIndex.get(token) || [];
    bucket.push(item);
    tokenIndex.set(token, bucket);
  }
}

for (const item of normalized) {
  const candidates = new Set();
  for (const token of item.tokens) {
    for (const candidate of tokenIndex.get(token) || []) {
      if (candidate.id !== item.id && candidate.subjectId === item.subjectId) candidates.add(candidate);
    }
  }

  const matches = [...candidates]
    .map((candidate) => ({ candidate, score: jaccard(item.tokens, candidate.tokens) }))
    .filter(({ score }) => score >= RELATED_THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RELATED_PER_QUESTION);

  for (const { candidate, score } of matches) {
    const type = score >= SIMILAR_THRESHOLD ? "similar" : "related";
    addRelation(item, candidate, type, score, {
      question_text_similarity: jaccard(item.questionTokens, candidate.questionTokens),
      choice_similarity: jaccard(item.choiceTokens, candidate.choiceTokens),
      answer_same: item.answer === candidate.answer,
      subject_same: item.subjectId === candidate.subjectId
    });
  }
}

const byQuestionId = Object.fromEntries(normalized.map((item) => [item.id, { exact: [], similar: [], related: [] }]));
for (const relation of relations) {
  const entry = toDisplayRelation(relation, relation.question_id);
  const reverse = toDisplayRelation(relation, relation.matched_question_id);
  byQuestionId[relation.question_id][relation.relation_type].push(reverse);
  byQuestionId[relation.matched_question_id][relation.relation_type].push(entry);
}

for (const groups of Object.values(byQuestionId)) {
  for (const list of Object.values(groups)) list.sort((a, b) => b.similarity - a.similarity);
}

await writeFile(outputPath, `${JSON.stringify({
  schema_version: "1.0",
  generated_at: new Date().toISOString(),
  source_question_count: questions.length,
  thresholds: { exact: 1, similar: SIMILAR_THRESHOLD, related: RELATED_THRESHOLD },
  relations,
  by_question_id: byQuestionId
}, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  sourceQuestions: questions.length,
  exactRelations: relations.filter((item) => item.relation_type === "exact").length,
  similarRelations: relations.filter((item) => item.relation_type === "similar").length,
  relatedRelations: relations.filter((item) => item.relation_type === "related").length,
  outputPath
}, null, 2));

function toComparableQuestion(question) {
  const questionText = normalize(question.question || "");
  const choiceText = (question.choices || []).map((choice) => normalize(choice.text || "")).join(" ");
  const fullText = `${questionText} ${choiceText}`.trim();
  return {
    id: question.id,
    subjectId: question.subjectId,
    answer: question.answer,
    questionTokens: tokens(questionText),
    choiceTokens: tokens(choiceText),
    tokens: tokens(fullText),
    exactKey: `${questionText}|${choiceText}|${question.answer}`
  };
}

function normalize(value) {
  return String(value).toLowerCase().replace(/<[^>]*>/g, " ").replace(/[^\p{L}\p{N}]+/gu, "").trim();
}

function tokens(value) {
  return new Set(value.match(/[\p{L}\p{N}]{2,}/gu) || [value].filter(Boolean));
}

function jaccard(left, right) {
  if (!left.size && !right.size) return 1;
  const intersection = [...left].filter((item) => right.has(item)).length;
  return intersection / (left.size + right.size - intersection || 1);
}

function groupBy(items, selector) {
  const groups = new Map();
  for (const item of items) {
    const key = selector(item);
    const group = groups.get(key) || [];
    group.push(item);
    groups.set(key, group);
  }
  return groups;
}

function addRelation(left, right, type, score, evidence) {
  const [first, second] = [left.id, right.id].sort();
  const key = `${first}|${second}|${type}`;
  if (relationKeys.has(key)) return;
  relationKeys.add(key);
  relations.push({
    relation_id: `rel_${String(relations.length + 1).padStart(6, "0")}`,
    question_id: left.id,
    matched_question_id: right.id,
    relation_type: type,
    similarity: Number(score.toFixed(4)),
    confidence: type === "exact" ? 0.99 : Number(Math.min(0.99, score + 0.05).toFixed(4)),
    evidence,
    review_status: "pending",
    status: "published"
  });
}

function toDisplayRelation(relation, currentId) {
  return {
    relation_id: relation.relation_id,
    question_id: currentId === relation.question_id ? relation.matched_question_id : relation.question_id,
    similarity: relation.similarity,
    confidence: relation.confidence,
    review_status: relation.review_status
  };
}
