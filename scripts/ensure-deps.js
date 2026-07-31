import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const nm = path.join(root, "node_modules");

const requiredFiles = [
  "express/package.json",
  "mongoose/package.json",
  "mongodb/lib/cursor/explainable_cursor.js",
  "iconv-lite/package.json",
  "passport/package.json",
];

function missingDeps() {
  return requiredFiles.filter((rel) => !fs.existsSync(path.join(nm, rel)));
}

function reinstall() {
  console.log("Corrupted node_modules detected. Reinstalling dependencies...");
  fs.rmSync(nm, { recursive: true, force: true });
  execSync("npm ci --omit=dev", {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });
}

let missing = missingDeps();
if (missing.length > 0) {
  console.warn("Missing dependency files:", missing.join(", "));
  reinstall();
  missing = missingDeps();
  if (missing.length > 0) {
    console.error("Dependencies still incomplete after reinstall:", missing.join(", "));
    process.exit(1);
  }
}

console.log("Dependencies OK");
