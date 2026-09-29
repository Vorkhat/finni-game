import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const androidDir = resolve("android");
const wrapper = resolve(androidDir, process.platform === "win32" ? "gradlew.bat" : "gradlew");
const tasks = process.argv.slice(2);
const environment = { ...process.env };

if (!environment.JAVA_HOME) {
  const jdkContainer = resolve(".tooling/jdk");
  if (existsSync(jdkContainer)) {
    const localJdk = readdirSync(jdkContainer, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => resolve(jdkContainer, entry.name))
      .find((entry) => existsSync(resolve(entry, "bin/java.exe")));
    if (localJdk) environment.JAVA_HOME = localJdk;
  }
}

const localSdk = resolve(".tooling/android-sdk");
if (!environment.ANDROID_HOME && existsSync(localSdk)) environment.ANDROID_HOME = localSdk;
if (!environment.ANDROID_SDK_ROOT && existsSync(localSdk)) environment.ANDROID_SDK_ROOT = localSdk;
if (!environment.GRADLE_USER_HOME) environment.GRADLE_USER_HOME = resolve(".tooling/gradle-home");

if (!existsSync(wrapper)) {
  console.error("Android Gradle wrapper not found. Run `pnpm android:add` first.");
  process.exit(1);
}

if (tasks.length === 0) {
  console.error("Pass at least one Gradle task, for example `assembleDebug`.");
  process.exit(1);
}

const result = spawnSync(wrapper, tasks, {
  cwd: androidDir,
  env: environment,
  shell: process.platform === "win32",
  stdio: "inherit",
});

if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
