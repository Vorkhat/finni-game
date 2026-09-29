import { copyFile, mkdir, unlink, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import { basename, resolve } from "node:path";

const outputDir = resolve("artifacts/android");
const mode = process.argv[2];
if (mode !== "debug" && mode !== "release")
  throw new Error("Usage: node scripts/export-android-artifacts.mjs debug|release");
const signingVariables = ["FINNI_RELEASE_STORE_FILE", "FINNI_RELEASE_STORE_PASSWORD", "FINNI_RELEASE_KEY_ALIAS", "FINNI_RELEASE_KEY_PASSWORD"];
const signingCount = signingVariables.filter((name) => process.env[name]).length;
if (signingCount > 0 && signingCount < signingVariables.length)
  throw new Error("Incomplete release signing configuration");
const signed = signingCount === signingVariables.length;
const artifacts = mode === "debug"
  ? [["android/app/build/outputs/apk/debug/app-debug.apk", "Finni-1.0.0-debug.apk"]]
  : [
      [signed ? "android/app/build/outputs/apk/release/app-release.apk" : "android/app/build/outputs/apk/release/app-release-unsigned.apk", signed ? "Finni-1.0.0-release.apk" : "Finni-1.0.0-release-unsigned.apk"],
      ["android/app/build/outputs/bundle/release/app-release.aab", signed ? "Finni-1.0.0-release.aab" : "Finni-1.0.0-release-unsigned.aab"],
    ];

async function sha256(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

await mkdir(outputDir, { recursive: true });
for (const name of ["Finni-1.0.0-debug.apk", "Finni-1.0.0-release.apk", "Finni-1.0.0-release-unsigned.apk", "Finni-1.0.0-release.aab", "Finni-1.0.0-release-unsigned.aab", "SHA256SUMS.txt"])
  await unlink(resolve(outputDir, name)).catch((error) => { if (error.code !== "ENOENT") throw error; });
const sums = [];

for (const [sourceName, destinationName] of artifacts) {
  const source = resolve(sourceName);
  if (!existsSync(source)) throw new Error(`Missing ${mode} build output: ${sourceName}`);
  const destination = resolve(outputDir, destinationName);
  await copyFile(source, destination);
  sums.push(`${await sha256(destination)}  ${basename(destination)}`);
  console.log(`Exported ${destination}`);
}

await writeFile(resolve(outputDir, "SHA256SUMS.txt"), `${sums.join("\n")}\n`, "utf8");
