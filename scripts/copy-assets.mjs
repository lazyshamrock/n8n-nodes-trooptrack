import fs from "fs";
import path from "path";

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function copyFile(src, dest) {
  if (!fs.existsSync(src)) {
    throw new Error(`Missing asset source file: ${src}`);
  }
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

const root = process.cwd();

// Source assets (do NOT live in dist)
const nodeIconSrc = path.join(root, "nodes", "TroopTrack", "trooptrack.png");
const credIconSrc = path.join(root, "credentials", "trooptrack.png");

// Destinations inside dist
const nodeIconDest = path.join(root, "dist", "nodes", "TroopTrack", "trooptrack.png");

// For credentials, the most reliable is next to the compiled credentials JS:
const credIconDest = path.join(root, "dist", "credentials", "trooptrack.png");

// Also copy to dist/credentials/icons for flexibility (optional but harmless)
const credIconDest2 = path.join(root, "dist", "credentials", "trooptrack.png");

copyFile(nodeIconSrc, nodeIconDest);
copyFile(credIconSrc, credIconDest);
copyFile(credIconSrc, credIconDest2);

console.log("Copied assets:");
console.log(`- ${nodeIconDest}`);
console.log(`- ${credIconDest}`);
console.log(`- ${credIconDest2}`);