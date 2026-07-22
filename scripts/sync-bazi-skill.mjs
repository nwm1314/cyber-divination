/**
 * 将 .claude/skills/bazi/references 同步到 src/lib/bazi/references
 * skill 为权威源，禁止业务手写第二套表。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const srcDir = path.join(root, ".claude", "skills", "bazi", "references");
const destDir = path.join(root, "src", "lib", "bazi", "references");

const FILES = [
  "wuxing-tables.md",
  "shichen-table.md",
  "dayun-rules.md",
  "classical-texts.md",
];

if (!fs.existsSync(srcDir)) {
  console.error(`[sync:skill] 权威源不存在: ${srcDir}`);
  process.exit(1);
}

fs.mkdirSync(destDir, { recursive: true });

const readme = `# bazi skill references（只读同步）

权威源：\`.claude/skills/bazi/references\`

请勿手改本目录。更新 skill 后执行：

\`\`\`bash
npm run sync:skill
\`\`\`
`;

fs.writeFileSync(path.join(destDir, "README.md"), readme, "utf8");

for (const file of FILES) {
  const from = path.join(srcDir, file);
  const to = path.join(destDir, file);
  if (!fs.existsSync(from)) {
    console.error(`[sync:skill] 缺少文件: ${from}`);
    process.exit(1);
  }
  fs.copyFileSync(from, to);
  console.log(`[sync:skill] ${file}`);
}

console.log(`[sync:skill] 完成 → ${destDir}`);
