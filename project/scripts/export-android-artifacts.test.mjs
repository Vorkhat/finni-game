import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";

const script = resolve(import.meta.dirname, "export-android-artifacts.mjs");
const signedEnv = Object.fromEntries([
  "FINNI_RELEASE_STORE_FILE", "FINNI_RELEASE_STORE_PASSWORD",
  "FINNI_RELEASE_KEY_ALIAS", "FINNI_RELEASE_KEY_PASSWORD",
].map((name) => [name, "fixture-only"]));

async function fixture(run) {
  const root = await mkdtemp(join(tmpdir(), "finni-android-export-"));
  try { await run(root); }
  finally {
    if (!resolve(root).startsWith(resolve(tmpdir()) + sep)) throw new Error("Unsafe fixture path");
    await rm(root, { recursive: true, force: true });
  }
}

async function output(root, relative, data = "fixture") {
  const path = join(root, relative);
  await mkdir(resolve(path, ".."), { recursive: true });
  await writeFile(path, data);
}

test("signed release exports both required files under signed names", () => fixture(async (root) => {
  await output(root, "android/app/build/outputs/apk/release/app-release.apk");
  await output(root, "android/app/build/outputs/bundle/release/app-release.aab");
  const result = spawnSync(process.execPath, [script, "release"], { cwd: root, env: { ...process.env, ...signedEnv } });
  assert.equal(result.status, 0, result.stderr.toString());
  assert.equal(await readFile(join(root, "artifacts/android/Finni-1.0.0-release.apk"), "utf8"), "fixture");
  assert.equal(await readFile(join(root, "artifacts/android/Finni-1.0.0-release.aab"), "utf8"), "fixture");
}));

test("missing release output fails and removes stale exports", () => fixture(async (root) => {
  await output(root, "android/app/build/outputs/bundle/release/app-release.aab");
  await output(root, "artifacts/android/Finni-1.0.0-release.apk", "stale");
  const result = spawnSync(process.execPath, [script, "release"], { cwd: root, env: { ...process.env, ...signedEnv } });
  assert.notEqual(result.status, 0);
  await assert.rejects(readFile(join(root, "artifacts/android/Finni-1.0.0-release.apk")));
}));
