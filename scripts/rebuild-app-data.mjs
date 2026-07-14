import { spawn } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const node = process.execPath;

const steps = [
  ["기출문제 런타임 JSON 생성", "scripts/generate-fire-questions-from-raw.mjs"],
  ["학습 패키지 생성 및 검증 보고서 갱신", "scripts/build-learning-json.mjs"],
  ["기출 회차별 모의시험 세트 생성", "scripts/generate-exam-sets.mjs"],
  ["30일/60일 학습 경로 생성", "scripts/generate-learning-paths.mjs"],
  ["앱용 subjects/lessons/questions/mock-exam 동기화", "scripts/sync-upload-package.mjs"]
];

for (const [label, script] of steps) {
  console.log(`\n▶ ${label}`);
  await run(script);
}

console.log("\n완료: data/02_learning_paths.json 및 앱용 4개 JSON을 재생성했습니다.");

function run(script) {
  return new Promise((resolve, reject) => {
    const child = spawn(node, [path.join(root, script)], {
      cwd: root,
      stdio: "inherit"
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${script} 종료 코드: ${code}`));
    });
  });
}
