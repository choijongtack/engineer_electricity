import { cp, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export const projectRoot = process.cwd();
export const dataRoot = path.join(projectRoot, "data");
export const rawCbtbankDir = path.join(dataRoot, "raw", "cbtbank");
export const learningDir = path.join(dataRoot, "learning", "v2-compatible");
export const seedDir = path.join(dataRoot, "seed", "supabase");
export const appDataDir = dataRoot;
export const defaultLearningSourceDir = path.join(projectRoot, "tmp", "zip_apply_batch1");
export const defaultCbtDataDir = path.join(dataRoot, "raw");
export const defaultCbtIndexPath = path.join(dataRoot, "raw", "index.json");
export const defaultProcessedExamsDir = rawCbtbankDir;

export const subjectIdMap = {
  소방원론: "fire_theory",
  소방전기회로: "electric_circuit",
  소방관계법규: "fire_law",
  "소방전기시설의 구조 및 원리": "fire_facility_electric"
};

export const subjectCodeMap = {
  FIRE_THEORY: "fire_theory",
  ELECTRIC_CIRCUIT: "electric_circuit",
  FIRE_LAW: "fire_law",
  ELECTRIC_FACILITY: "fire_facility_electric"
};

export const subjectDescriptions = {
  fire_theory: "화재, 연소, 소화, 위험물, 피난 계획 등 기본 개념을 학습합니다.",
  electric_circuit: "전기 기초, 회로, 자동제어, 전자 기초를 학습합니다.",
  fire_law: "소방관계법규의 핵심 조문과 적용 기준을 학습합니다.",
  fire_facility_electric: "경보, 피난, 비상전원, 전기 소방설비 구조와 원리를 학습합니다."
};

export function normalizeSubjectId(value) {
  if (!value) {
    return null;
  }
  return subjectIdMap[value] || subjectCodeMap[value] || null;
}

export async function ensureDir(targetPath) {
  await mkdir(targetPath, { recursive: true });
}

export async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

export async function writeJson(filePath, value) {
  await ensureDir(path.dirname(filePath));
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function fileExists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function listJsonFiles(dirPath) {
  if (!(await fileExists(dirPath))) {
    return [];
  }
  const entries = await readdir(dirPath);
  return entries.filter((entry) => entry.endsWith(".json")).sort();
}

export async function loadContentFiles(baseDir) {
  const files = await listJsonFiles(baseDir);
  const contentFiles = files.filter((file) => /^\d+_contents_.*\.json$/i.test(file));
  const contentGroups = await Promise.all(contentFiles.map((file) => readJson(path.join(baseDir, file))));
  return contentGroups.flat();
}

export function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

export function sortByLearningOrder(items) {
  return [...items].sort((left, right) => {
    const leftOrder = Number(left.learning_order || 0);
    const rightOrder = Number(right.learning_order || 0);
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }
    return String(left.content_id || "").localeCompare(String(right.content_id || ""));
  });
}

export function buildReviewFlags(question) {
  const reasons = [];
  const text = [question.question_text, question.explanation, question.answer_text]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (question.subject === "소방관계법규") {
    reasons.push("law_subject");
  }

  if (Array.isArray(question.images) && question.images.length > 0) {
    reasons.push("has_image");
  }

  if (/(개정|법령|기준|규정|nfsc|소방법|시행령|시행규칙)/i.test(text)) {
    reasons.push("regulation_or_revision_risk");
  }

  if (/(m2|m3|mm|cm|lx|kg|%|리터|암페어|볼트|와트|옴|헤르츠)/i.test(text)) {
    reasons.push("numeric_or_unit_risk");
  }

  return {
    needsReview: reasons.length > 0,
    reviewReason: unique(reasons).join(", ")
  };
}

export async function copyDirectoryContents(sourceDir, targetDir, fileNames = null) {
  await ensureDir(targetDir);
  if (fileNames) {
    await Promise.all(
      fileNames.map(async (fileName) => {
        const sourcePath = path.join(sourceDir, fileName);
        if (await fileExists(sourcePath)) {
          await cp(sourcePath, path.join(targetDir, fileName));
        }
      })
    );
    return;
  }

  await cp(sourceDir, targetDir, { recursive: true, force: true });
}
