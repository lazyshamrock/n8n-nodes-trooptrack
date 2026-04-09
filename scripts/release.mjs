#!/usr/bin/env node
/**
 * scripts/release.mjs
 *
 * One command release flow:
 * - pick version bump interactively (or pass via CLI)
 * - run tests/build (configurable)
 * - npm version <bump> (updates package.json + creates git tag)
 * - npm publish
 * - git push --follow-tags
 *
 * Usage:
 *   node scripts/release.mjs
 *   node scripts/release.mjs --bump patch
 *   node scripts/release.mjs --bump minor --dry-run
 *   node scripts/release.mjs --bump prerelease --preid beta
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

const cwd = process.cwd();

function run(cmd, args, opts = {}) {
  const pretty = `${cmd} ${args.join(" ")}`;
  if (opts.echo !== false) console.log(`\n> ${pretty}`);
  const res = spawnSync(cmd, args, {
    cwd,
    stdio: "inherit",
    shell: false,
    env: process.env,
  });

  if (res.status !== 0) {
    throw new Error(`Command failed (${res.status}): ${pretty}`);
  }
}

function runCapture(cmd, args) {
  const res = spawnSync(cmd, args, {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
    env: process.env,
    encoding: "utf8",
  });
  if (res.status !== 0) {
    const err = (res.stderr || "").trim();
    throw new Error(`Command failed (${res.status}): ${cmd} ${args.join(" ")}\n${err}`);
  }
  return (res.stdout || "").trim();
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--bump") out.bump = argv[++i];
    else if (a === "--preid") out.preid = argv[++i];
    else if (a === "--dry-run") out.dryRun = true;
    else if (a === "--skip-tests") out.skipTests = true;
    else if (a === "--skip-build") out.skipBuild = true;
    else if (a === "--skip-git") out.skipGit = true;
    else if (a === "--skip-publish") out.skipPublish = true;
    else if (a === "--help" || a === "-h") out.help = true;
  }
  return out;
}

function usage() {
  console.log(`
Release script

Usage:
  node scripts/release.mjs [options]

Options:
  --bump <patch|minor|major|prerelease|prepatch|preminor|premajor>
  --preid <alpha|beta|rc>          Used with pre* bumps, default "beta"
  --dry-run                        No changes, prints what would happen
  --skip-tests                     Skip npm test (if present)
  --skip-build                     Skip npm run build (if present)
  --skip-git                       Skip git commit/tag/push checks
  --skip-publish                   Skip npm publish
`);
}

function ensureInRepoRoot() {
  const pkgPath = path.join(cwd, "package.json");
  if (!fs.existsSync(pkgPath)) {
    throw new Error("No package.json found. Run this from the repo root.");
  }
  return pkgPath;
}

function hasScript(pkgJson, name) {
  return Boolean(pkgJson.scripts && pkgJson.scripts[name]);
}

async function pickList(question, items, defaultIndex = 0) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const menu = items
    .map((it, idx) => {
      const marker = idx === defaultIndex ? "*" : " ";
      return `  ${marker} ${idx + 1}) ${it.label}`;
    })
    .join("\n");

  const prompt = `${question}\n${menu}\nChoose [${defaultIndex + 1}]: `;

  const answer = await new Promise((resolve) => rl.question(prompt, resolve));
  rl.close();

  const trimmed = String(answer || "").trim();
  if (!trimmed) return items[defaultIndex].value;

  const n = Number.parseInt(trimmed, 10);
  if (!Number.isNaN(n) && n >= 1 && n <= items.length) return items[n - 1].value;

  const byValue = items.find((x) => x.value === trimmed);
  if (byValue) return byValue.value;

  throw new Error(`Invalid choice: ${trimmed}`);
}

function ensureCleanGit() {
  const status = runCapture("git", ["status", "--porcelain"]);
  if (status) {
    throw new Error("Git working tree is not clean. Commit or stash changes before releasing.");
  }
}

function ensureNpmAuth() {
  const who = runCapture("npm", ["whoami"]);
  if (!who) throw new Error("Not logged into npm. Run: npm login");
  console.log(`npm user: ${who}`);
}

function ensureOnMainBranch() {
  const branch = runCapture("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
  console.log(`git branch: ${branch}`);
}

function currentVersion(pkgJson) {
  return pkgJson.version || "0.0.0";
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    process.exit(0);
  }

  const pkgPath = ensureInRepoRoot();
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

  const bumpOptions = [
    { label: "patch (x.y.Z)", value: "patch" },
    { label: "minor (x.Y.0)", value: "minor" },
    { label: "major (X.0.0)", value: "major" },
    { label: "prepatch (x.y.Z-beta.0)", value: "prepatch" },
    { label: "preminor (x.Y.0-beta.0)", value: "preminor" },
    { label: "premajor (X.0.0-beta.0)", value: "premajor" },
    { label: "prerelease (increment beta/rc/etc)", value: "prerelease" },
  ];

  const bump =
    args.bump ||
    (await pickList(
      `Current version: ${currentVersion(pkg)}\nSelect version bump type:`,
      bumpOptions,
      0
    ));

  const preid = args.preid || "beta";
  const dryRun = Boolean(args.dryRun);

  console.log(`\nRelease plan`);
  console.log(`- bump: ${bump}${bump.startsWith("pre") || bump === "prerelease" ? ` (preid=${preid})` : ""}`);
  console.log(`- dry-run: ${dryRun ? "yes" : "no"}`);
  console.log(`- scripts: test=${hasScript(pkg, "test") ? "yes" : "no"}, build=${hasScript(pkg, "build") ? "yes" : "no"}`);

  if (!args.skipGit) {
    ensureOnMainBranch();
    ensureCleanGit();
  }

  ensureNpmAuth();

  if (dryRun) {
    console.log("\nDry run enabled. No commands will be executed.");
    process.exit(0);
  }

  if (!args.skipTests && hasScript(pkg, "test")) {
    run("npm", ["test"]);
  }

  if (!args.skipBuild && hasScript(pkg, "build")) {
    run("npm", ["run", "build"]);
  }

  // Version bump and tag (uses npm version). This writes package.json + creates a git commit/tag by default.
  // If you do not want git commit/tag, add "--no-git-tag-version" here (not recommended).
  const npmVersionArgs = ["version", bump];
  if (bump.startsWith("pre") || bump === "prerelease") {
    npmVersionArgs.push("--preid", preid);
  }
  run("npm", npmVersionArgs);

  if (!args.skipPublish) {
    const buildsDir = path.join(cwd, "builds");

    if (!fs.existsSync(buildsDir)) {
      fs.mkdirSync(buildsDir);
    }

    console.log("\nPackaging into /builds...");
    run("npm", ["pack", "--pack-destination", "builds"]);

    const files = fs.readdirSync(buildsDir).filter(f => f.endsWith(".tgz"));
    if (files.length === 0) {
      throw new Error("No package tarball found in /builds");
    }

    const tarball = path.join("builds", files.sort().pop());
    console.log(`Publishing ${tarball}...`);
    run("npm", ["publish", tarball]);
  }

  if (!args.skipGit) {
    run("git", ["push", "--follow-tags"]);
  }

  console.log("\nDone. Released and published.");
}

main().catch((err) => {
  console.error(`\nRelease failed: ${err.message}`);
  process.exit(1);
});