import { getFirebaseServices } from "./firebaseClient.js";

const cache = {
  subjects: null,
  lessons: null,
  questions: null,
  mockExam: null,
  learningPaths: null
};

function validateQuestionIds(questions) {
  const seen = new Set();
  const duplicateIds = new Set();
  const missingIndexes = [];

  questions.forEach((question, index) => {
    const questionId = question?.id;
    if (!questionId || typeof questionId !== "string" || !questionId.trim()) {
      missingIndexes.push(index);
      return;
    }

    if (seen.has(questionId)) {
      duplicateIds.add(questionId);
      return;
    }

    seen.add(questionId);
  });

  if (missingIndexes.length || duplicateIds.size) {
    const details = [];
    if (missingIndexes.length) {
      details.push(`missing IDs at indexes: ${missingIndexes.join(", ")}`);
    }
    if (duplicateIds.size) {
      details.push(`duplicate IDs: ${[...duplicateIds].join(", ")}`);
    }
    throw new Error(`fire_questions.json validation failed (${details.join(" / ")})`);
  }

  return questions;
}

async function loadJson(path) {
  const filename = path.split("/").pop();
  let response = null;

  try {
    const services = await getFirebaseServices();
    if (services) {
      const fileRef = services.storageModule.ref(services.storage, `fire/${filename}`);
      const downloadUrl = await services.storageModule.getDownloadURL(fileRef);
      response = await fetch(downloadUrl);
    }
  } catch (error) {
    console.warn(`Firebase Storage 콘텐츠를 읽지 못해 로컬 파일을 사용합니다: ${filename}`, error);
  }

  response ||= await fetch(path);
  if (!response.ok) {
    throw new Error(`데이터 로드 실패: ${path}`);
  }
  return response.json();
}

async function loadSubjects() {
  cache.subjects ||= await loadJson("./data/fire_subjects.json");
  return cache.subjects;
}

async function loadLessons() {
  cache.lessons ||= await loadJson("./data/fire_lessons.json");
  return cache.lessons;
}

async function loadQuestions() {
  cache.questions ||= validateQuestionIds(await loadJson("./data/fire_questions.json"));
  return cache.questions;
}

async function loadMockExam() {
  cache.mockExam ||= await loadJson("./data/fire_mock-exam.json");
  return cache.mockExam;
}

async function loadLearningPaths() {
  cache.learningPaths ||= await loadJson("./data/learning/v2-compatible/02_learning_paths.json");
  return cache.learningPaths;
}

export async function getQuestionById(questionId) {
  const questions = await loadQuestions();
  return questions.find((question) => question.id === questionId) || null;
}

export async function loadAllData() {
  const [subjects, lessons, questions, mockExam, learningPaths] = await Promise.all([
    loadSubjects(),
    loadLessons(),
    loadQuestions(),
    loadMockExam(),
    loadLearningPaths()
  ]);

  return { subjects, lessons, questions, mockExam, learningPaths };
}
