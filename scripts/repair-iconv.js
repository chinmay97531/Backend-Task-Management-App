import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const iconvRoot = path.join(root, "node_modules", "iconv-lite");
const indexFile = path.join(iconvRoot, "lib", "index.js");
const helperDir = path.join(iconvRoot, "lib", "helpers");
const helperFile = path.join(helperDir, "merge-exports.js");

const MERGE_EXPORTS_SOURCE = `"use strict"

var hasOwn = typeof Object.hasOwn === "undefined" ? Function.call.bind(Object.prototype.hasOwnProperty) : Object.hasOwn

function mergeModules (target, module) {
  for (var key in module) {
    if (hasOwn(module, key)) {
      target[key] = module[key]
    }
  }
}

module.exports = mergeModules
`;

if (!fs.existsSync(indexFile)) {
  console.warn("iconv-lite not installed yet; skipping repair");
  process.exit(0);
}

const indexSource = fs.readFileSync(indexFile, "utf8");
if (indexSource.includes("merge-exports") && !fs.existsSync(helperFile)) {
  fs.mkdirSync(helperDir, { recursive: true });
  fs.writeFileSync(helperFile, MERGE_EXPORTS_SOURCE);
  console.log("Repaired missing iconv-lite/lib/helpers/merge-exports.js");
}
