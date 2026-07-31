import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.dirname(fileURLToPath(import.meta.url));
const helper = path.join(
  root,
  "..",
  "node_modules",
  "iconv-lite",
  "lib",
  "helpers",
  "merge-exports.js"
);

if (!fs.existsSync(helper)) {
  console.error(
    "iconv-lite is incomplete (missing helpers/merge-exports.js). Clear Render build cache and redeploy."
  );
  process.exit(1);
}

console.log("iconv-lite OK");
