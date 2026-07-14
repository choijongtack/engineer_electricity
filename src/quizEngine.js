import { getQuestionById } from "./dataLoader.js";
import { saveQuestionResult } from "./storage.js";

export function checkAnswer(question, selectedChoice) {
  const normalizedChoice = Number(selectedChoice);
  return {
    isCorrect: question.answer === normalizedChoice,
    correctChoice: question.answer,
    explanation: question.explanation
  };
}

export async function submitAnswer(questionId, selectedChoice, metadata = {}) {
  const question = await getQuestionById(questionId);
  if (!question) {
    throw new Error("문제를 찾을 수 없습니다.");
  }

  const result = checkAnswer(question, selectedChoice);
  saveQuestionResult(question.id, Number(selectedChoice), result.isCorrect, {
    subjectId: question.subjectId,
    ...metadata
  });

  return {
    question,
    ...result
  };
}
