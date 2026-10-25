// Compares the last golden run (test-results/golden-render) with the
// committed baseline (tests/golden/render): which fixtures' guide and prompt
// changed. Usage: npx tsx scripts/golden/diff-report.ts
import { createHash } from "crypto";
import fs from "fs";
import path from "path";

const run = "test-results/golden-render";
const base = "tests/golden/render";
const lf = (s: string) => s.replace(/\r\n/g, "\n");
const rows = fs.readdirSync(base).sort().map((id) => {
  const sha = createHash("sha256").update(fs.readFileSync(path.join(run, id, "guide.png"))).digest("hex");
  const guide = sha === fs.readFileSync(path.join(base, id, "guide.sha256"), "utf8").trim();
  const before = lf(fs.readFileSync(path.join(base, id, "prompt.txt"), "utf8")).split("\n");
  const after = lf(fs.readFileSync(path.join(run, id, "prompt.txt"), "utf8")).split("\n");
  const changedLines = after.filter((l, i) => l !== before[i]).length + Math.max(0, before.length - after.length);
  return { id, guide: guide ? "same" : "CHANGED", prompt: changedLines ? `CHANGED (${changedLines} lines)` : "same" };
});
for (const r of rows) console.log(r.id.padEnd(28), "guide:", r.guide.padEnd(8), "prompt:", r.prompt);
const g = rows.filter((r) => r.guide !== "same").length, p = rows.filter((r) => r.prompt !== "same").length;
console.log(`\n${rows.length} fixtures — guide changed: ${g}, prompt changed: ${p}`);
