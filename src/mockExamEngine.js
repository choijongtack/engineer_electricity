import { getQuestionById } from "./dataLoader.js";
import { MOCK_EXAM_SOURCE } from "./progression.js";
import { saveMockExamResult, saveQuestionResult } from "./storage.js";

let activeExam = null;

export async function startMockExam(mockExam) {
  const questions = await Promise.all(mockExam.questionIds.map((questionId) => getQuestionById(questionId)));
  activeExam = {
    examId: mockExam.id,
    title: mockExam.title,
    durationMinutes: mockExam.durationMinutes,
    startedAt: Date.now(),
    questions: questions.filter(Boolean),
    answers: {}
  };
  return activeExam;
}

export function selectExamAnswer(questionId, selectedChoice) {
  if (!activeExam) {
    throw new Error("진행 중인 모의고사가 없습니다.");
  }
  activeExam.answers[questionId] = Number(selectedChoice);
  return activeExam;
}

function calculateExamResult(answers, questions) {
  let correctCount = 0;
  const subjectScores = {};

  for (const question of questions) {
    const selectedChoice = Number(answers[question.id]);
    const isCorrect = selectedChoice === question.answer;
    if (isCorrect) {
      correctCount += 1;
    }

    subjectScores[question.subjectId] ||= { total: 0, correct: 0 };
    subjectScores[question.subjectId].total += 1;
    subjectScores[question.subjectId].correct += isCorrect ? 1 : 0;
  }

  return {
    totalQuestions: questions.length,
    correctCount,
    score: questions.length ? Math.round((correctCount / questions.length) * 100) : 0,
    subjectScores
  };
}

export function submitMockExam() {
  if (!activeExam) {
    throw new Error("진행 중인 모의고사가 없습니다.");
  }

  const result = calculateExamResult(activeExam.answers, activeExam.questions);
  const payload = {
    examId: activeExam.examId,
    submittedAt: new Date().toISOString(),
    ...result
  };

  for (const question of activeExam.questions) {
    const selectedChoice = Number(activeExam.answers[question.id] || 0);
    const isCorrect = selectedChoice === question.answer;
    saveQuestionResult(question.id, selectedChoice, isCorrect, {
      subjectId: question.subjectId,
      sourceType: MOCK_EXAM_SOURCE,
      sourceId: activeExam.examId
    });
  }

  saveMockExamResult(payload);
  activeExam = null;
  return payload;
}

export function getActiveExam() {
  return activeExam;
}
