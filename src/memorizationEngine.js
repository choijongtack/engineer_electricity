import { saveMemorizationStat } from "./storage.js";

function normalizeWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeItemType(type) {
  if (type === "choice" || type === "ox") {
    return type;
  }
  return "short-answer";
}

function buildAnswerLabel(id, answerLabel) {
  if (answerLabel) {
    return answerLabel;
  }
  return String(id || "").startsWith("BQ_") ? "빈칸 답안" : "기억 답안";
}

function normalizeExistingItem(lesson, item, index) {
  const itemId = item.id || `MC_${lesson.id}_${index + 1}`;
  return {
    id: itemId,
    type: normalizeItemType(item.type),
    prompt: normalizeWhitespace(item.prompt),
    answer: normalizeWhitespace(item.answer),
    acceptableAnswers: (item.acceptableAnswers || []).map(normalizeWhitespace).filter(Boolean),
    hint: normalizeWhitespace(item.hint || lesson.summary || lesson.title),
    answerLabel: buildAnswerLabel(itemId, item.answerLabel),
    choices: Array.isArray(item.choices) ? item.choices : []
  };
}

function sanitizeSourceText(value) {
  return normalizeWhitespace(value)
    .replace(/\s*\/\s*함정:.*/u, "")
    .replace(/\s*\/\s*주의:.*/u, "");
}

function getPreferredConceptText(lesson) {
  const cards = lesson.conceptCards || [];
  const easyCard = cards.find((card) => String(card.id || "").endsWith("-EASY"));
  const pointCard = cards.find((card) => String(card.id || "").endsWith("-POINT"));
  const coreCard = cards.find((card) => String(card.id || "").endsWith("-CORE"));
  const keyword = (pointCard?.keywords || []).find((value) => normalizeWhitespace(value).length >= 4);

  return (
    sanitizeSourceText(easyCard?.body) ||
    sanitizeSourceText(pointCard?.body) ||
    sanitizeSourceText(keyword) ||
    sanitizeSourceText(coreCard?.body) ||
    sanitizeSourceText(lesson.summary) ||
    normalizeWhitespace(lesson.title)
  );
}

function trimSentence(text) {
  const normalized = sanitizeSourceText(text);
  const firstSentence = normalized.split(/(?<=[.!?])\s+/u)[0] || normalized;
  return normalizeWhitespace(firstSentence);
}

function buildRecallPrompt(lesson, answer) {
  if (answer.includes("=") || answer.includes("+")) {
    return `${lesson.title}의 식 또는 구성 요소를 쓰세요`;
  }
  if (/\d/.test(answer)) {
    return `${lesson.title}의 기준 값을 쓰세요`;
  }
  if (answer.includes(",")) {
    return `${lesson.title}의 항목을 쓰세요`;
  }
  return `${lesson.title}의 핵심 개념을 쓰세요`;
}

function selectClozeAnswer(answer) {
  const listParts = answer.split(",").map((part) => normalizeWhitespace(part)).filter(Boolean);
  if (listParts.length >= 2) {
    return listParts.at(-1);
  }

  const formulaParts = answer.split("+").map((part) => normalizeWhitespace(part)).filter(Boolean);
  if (formulaParts.length >= 2) {
    return formulaParts.at(-1);
  }

  const words = answer.split(" ").map((part) => normalizeWhitespace(part)).filter(Boolean);
  if (words.length >= 2) {
    return words.at(-1);
  }

  return answer;
}

function buildClozePrompt(lesson, answer, clozeAnswer) {
  if (answer.includes(clozeAnswer) && answer !== clozeAnswer) {
    return answer.replace(clozeAnswer, "(    )");
  }
  return `${lesson.title}의 빈칸에 들어갈 말을 쓰세요. (    )`;
}

function buildAcceptableAnswers(answer) {
  const normalized = normalizeWhitespace(answer);
  const answers = new Set([normalized, normalized.replace(/\s+/g, "")]);
  return [...answers].filter(Boolean);
}

function buildGeneratedItemsForLesson(lesson) {
  const sourceText = trimSentence(getPreferredConceptText(lesson));
  const recallAnswer = sourceText || normalizeWhitespace(lesson.title);
  const clozeAnswer = selectClozeAnswer(recallAnswer);

  return [
    {
      id: `MC_${lesson.id}`,
      type: "short-answer",
      prompt: buildRecallPrompt(lesson, recallAnswer),
      answer: recallAnswer,
      acceptableAnswers: buildAcceptableAnswers(recallAnswer),
      hint: normalizeWhitespace(lesson.summary || lesson.title),
      answerLabel: "기억 답안",
      choices: []
    },
    {
      id: `BQ_${lesson.id}`,
      type: "short-answer",
      prompt: buildClozePrompt(lesson, recallAnswer, clozeAnswer),
      answer: clozeAnswer,
      acceptableAnswers: buildAcceptableAnswers(clozeAnswer),
      hint: normalizeWhitespace(lesson.summary || lesson.title),
      answerLabel: "빈칸 답안",
      choices: []
    }
  ];
}

function buildMemorizationItemsForLesson(lesson) {
  if (Array.isArray(lesson.memorizationItems) && lesson.memorizationItems.length) {
    return lesson.memorizationItems.map((item, index) => normalizeExistingItem(lesson, item, index));
  }

  return buildGeneratedItemsForLesson(lesson);
}

export function getMemorizationItems(lessons) {
  return lessons.flatMap((lesson) =>
    buildMemorizationItemsForLesson(lesson).map((item, index) => ({
      ...item,
      lessonId: lesson.id,
      lessonTitle: lesson.title,
      subjectId: lesson.subjectId,
      itemIndex: index + 1
    }))
  );
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFC")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[()]/g, "")
    .replace(/[,:;./]/g, " ")
    .trim();
}

function splitMeaningParts(value) {
  return String(value || "")
    .normalize("NFC")
    .split(/\s*(?:\+|=|<|>|,|\/|->)\s*/u)
    .map(normalizeText)
    .filter((part) => part.length >= 2);
}

function hasOrderedRelation(value) {
  return /(?:=|<|>|->)/u.test(String(value || ""));
}

function includesPartsInOrder(fullText, parts) {
  let startIndex = 0;

  for (const part of parts) {
    const foundIndex = fullText.indexOf(part, startIndex);
    if (foundIndex < 0) {
      return false;
    }
    startIndex = foundIndex + part.length;
  }

  return true;
}

function matchesShortAnswerCandidate(userAnswer, candidate) {
  const normalizedUser = normalizeText(userAnswer);
  const normalizedCandidate = normalizeText(candidate);
  if (!normalizedUser || !normalizedCandidate) {
    return false;
  }

  if (normalizedUser === normalizedCandidate) {
    return true;
  }

  const candidateParts = splitMeaningParts(candidate);
  if (candidateParts.length < 2) {
    return false;
  }

  if (hasOrderedRelation(candidate)) {
    return includesPartsInOrder(normalizedUser, candidateParts);
  }

  return candidateParts.every((part) => normalizedUser.includes(part));
}

function normalizeOx(value) {
  const normalized = normalizeText(value);
  if (["o", "0", "true", "t", "yes", "y", "맞다", "참"].includes(normalized)) {
    return "o";
  }
  if (["x", "false", "f", "no", "n", "틀리다", "거짓"].includes(normalized)) {
    return "x";
  }
  return normalized;
}

export function checkMemorizationAnswer(item, userAnswer) {
  if (item.type === "choice") {
    return normalizeText(userAnswer) === normalizeText(item.answer);
  }

  if (item.type === "ox") {
    return normalizeOx(userAnswer) === normalizeOx(item.answer);
  }

  const normalizedAnswer = normalizeText(userAnswer);
  const candidates = [item.answer, ...(item.acceptableAnswers || [])].map(normalizeText);
  if (candidates.includes(normalizedAnswer)) {
    return true;
  }

  return [item.answer, ...(item.acceptableAnswers || [])].some((candidate) =>
    matchesShortAnswerCandidate(userAnswer, candidate)
  );
}

export function saveMemorizationResult(item, isCorrect) {
  return saveMemorizationStat(item.id, isCorrect, {
    subjectId: item.subjectId,
    lessonId: item.lessonId
  });
}
