# Этап 5 — рабочий checklist

Создан до Android-изменений. `[x]` ставится только после фактической проверки.

## Baseline

- [x] `pnpm lint` PASS до Capacitor.
- [x] `pnpm test` — 74/74 PASS до Capacitor.
- [x] `pnpm build` PASS до Capacitor; фактический webDir определён.
- [x] `pnpm e2e` — 63/63 PASS до Capacitor.

## Capacitor и Android project

- [x] Официальные совместимые Capacitor dependencies установлены и версии зафиксированы.
- [x] `capacitor.config.ts`: `ru.onesolution.finni`, «Финни», bundled production webDir, без server URL.
- [x] `android/` создан официальным tooling и воспроизводим.
- [x] Scripts sync/open/debug/release/AAB реально соответствуют monorepo.
- [x] minSdk 26, portrait Activity, versionName 1.0.0, versionCode 1.
- [x] Status/navigation bars и system insets настроены; отсутствие перекрытий требует device QA.
- [x] Android Back реализован: modal → history/router → exit на Home; device QA остаётся обязательным.

## Branding и package audit

- [x] Source icon 512×512 и adaptive foreground/background подготовлены из утверждённого art.
- [x] Splash использует локальный branding без искусственной задержки.
- [x] Launcher/app label — «Финни»; placeholder names отсутствуют.
- [x] Android runtime содержит только production web bundle, без docs/tests/QA/source maps.
- [x] Manifest permissions проаудированы и сведены к необходимому минимуму.

## Builds и проверка artifacts

- [x] `pnpm android:sync` PASS.
- [x] Gradle debug APK build PASS; точный путь и размер проверены.
- [x] Release APK build PASS в unsigned-варианте; signing status зафиксирован честно.
- [x] Release AAB build PASS в unsigned-варианте; точный путь и размер проверены.
- [x] Package/version/minSdk/targetSdk/permissions/signing проверены Android tools.
- [x] Secrets/keys/private URLs audit выполнен; keystore/password не добавлены.

## QA

- [x] Финальные `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm e2e` PASS.
- [x] Emulator доступность проверена: emulator/AVD отсутствуют, screenshots не создавались.
- [x] Physical-device доступность проверена: `adb devices -l` пуст, `PHYSICAL DEVICE QA REQUIRED`.
- [x] Persistence/update/process-kill/keyboard/touch/long-press/Back/offline имеют device checklist.
- [x] Appendix A и Demo isolation имеют Android status `MANUAL REQUIRED`, без подмены browser evidence.

## Документация

- [x] README содержит проверенные Web/Android команды и prerequisites.
- [x] `docs/android-build.md`, `docs/android-device-qa.md`, `docs/android-signing.md`.
- [x] `docs/release-checklist.md`, `docs/rustore-technical.md`.
- [x] Requirements matrix и traceability обновлены честно.
- [x] `docs/stage5-report.md` содержит paths, sizes, permissions и remaining blockers.
