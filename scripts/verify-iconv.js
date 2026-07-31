import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const indexFile = path.join(root, "node_modules", "iconv-lite", "lib", "index.js");
const helperFile = path.join(
  root,
  "node_modules",
  "iconv-lite",
  "lib",
  "helpers",
  "merge-exports.js"
);

if (!fs.existsSync(indexFile)) {
  console.error("iconv-lite is not installed");
  process.exit(1);
}

const indexSource = fs.readFileSync(indexFile, "utf8");
if (indexSource.includes("merge-exports") && !fs.existsSync(helperFile)) {
  console.error("iconv-lite is incomplete (missing helpers/merge-exports.js)");
  process.exit(1);
}

console.log("iconv-lite OK");
