# Этап 5 — Capacitor Android, offline APK и release build

## Capacitor

Статус: **PASS**.

- Capacitor Core/CLI/Android 8.5.2; App 8.1.1, Splash Screen 8.0.2, Status Bar 8.0.3.
- `appId`: `ru.onesolution.finni`; `appName`: «Финни».
- `webDir`: `apps/web/dist`; `server.url` отсутствует.
- `pnpm android:sync` сначала создаёт production Vite bundle, затем выполняет `cap sync android`.

## Android

Статус: **BUILD PASS / DEVICE QA REQUIRED**.

- Native project создан официальным Capacitor tooling.
- minSdk 26; target/compileSdk 36; Android 8.0+.
- versionName `1.0.0`; versionCode `1`; portrait; `adjustResize`.
- Проверенный stack: Microsoft OpenJDK 21.0.12.1, Gradle 8.14.3, Android Gradle Plugin 8.13.0.
- Portable bootstrap не меняет системный PATH и хранит SDK/JDK/Gradle cache в игнорируемой `.tooling/`.

## Offline

Статус: **PACKAGING PASS / INSTALLED APK MANUAL REQUIRED**.

Android assets содержат 55 production web-файлов общим объёмом 4,252,209 bytes. В bundle нет source maps, `.ts`/`.tsx`, tests, docs или QA evidence. INTERNET permission удалён; обязательные remote API/assets отсутствуют. Browser offline/request-blocking E2E прошёл, но cold launch установленного APK в airplane mode требует устройства.

## Android Back

Статус: **IMPLEMENTED / DEVICE QA REQUIRED**.

Native handler сначала отправляет `cancel` открытому dialog, затем возвращается по history на вложенных маршрутах и завершает Activity на `/`, `/boot` и `/home`. Source/build validation пройдена; hardware/gesture Back на устройстве не проверялся.

## Persistence

Статус: **BROWSER PASS / DEVICE QA REQUIRED**.

Игра сохраняет профиль атомарно в WebView localStorage. Unit/integration и browser reload проверяют награды, покупки, план, переводы, периоды, Demo isolation и delete/reset. Background/resume, force-stop/process kill и `adb install -r` между versionCode требуют physical-device acceptance.

## Keyboard

Статус: **CONFIGURED / DEVICE QA REQUIRED**.

Activity использует `adjustResize`; mobile CSS ограничивает modals и сохраняет scroll/CTA. Фактические IME, numeric keyboard, focus, touch и трёхсекундный long press нужно проверить на Android 8 и современном Android.

## Icon & Splash

Статус: **GENERATED / DEVICE DISPLAY REQUIRED**.

Из утверждённого локального art воспроизводимо созданы source 512×512, adaptive foreground/background, launcher resources и portrait splash. Source/generated изображения визуально проверены; отображение launcher masks и отсутствие launch flash проверяется на устройстве.

## Permissions

Статус: **PASS**.

Merged manifest не содержит INTERNET, storage, location, camera, contacts, microphone, advertising или analytics permissions. Присутствует только generated signature-level `ru.onesolution.finni.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`. Также зафиксированы `allowBackup=false` и `usesCleartextTraffic=false`.

## Builds

Статус: **PASS**.

| Артефакт | Размер | SHA-256 |
|---|---:|---|
| `artifacts/android/Finni-1.0.0-debug.apk` | 13,876,784 B / 13.23 MiB | `34fa7d4588a9b2a3e4c02c37376cb5f39af08e8ba8850f3e20426dd6d0d05f4b` |
| `artifacts/android/Finni-1.0.0-release-unsigned.apk` | 10,653,210 B / 10.16 MiB | `311adc549028dd07e1566ed8c89eb1b4be475108b39a5e4d5bde530e57222e72` |
| `artifacts/android/Finni-1.0.0-release-unsigned.aab` | 10,518,588 B / 10.03 MiB | `8627b5afca5009c7cd648d412d32d83779f59ef47c754d32d5a6f231d31765d9` |

`apkanalyzer`/`aapt` подтвердили package, version, min/target SDK и launcher Activity. Оба APK zipaligned. Полный checksum-файл: `artifacts/android/SHA256SUMS.txt`.

## Signing

Статус: **INFRASTRUCTURE PASS / OWNER KEY REQUIRED**.

Debug APK подписан Android Debug certificate (v2; certificate SHA-256 `9cc54620…141d0395`) и годится только для QA. Release APK и AAB намеренно unsigned. Gradle читает `FINNI_RELEASE_STORE_FILE`, `FINNI_RELEASE_STORE_PASSWORD`, `FINNI_RELEASE_KEY_ALIAS`, `FINNI_RELEASE_KEY_PASSWORD`, отклоняет частичный набор и отсутствующий keystore. Секретов/keystore в репозитории нет.

## Automated QA

Статус: **PASS**.

- `pnpm lint` — PASS.
- `pnpm test` — 11 files, 74/74 PASS.
- `pnpm build` — PASS, 85 modules.
- `pnpm e2e` — 63/63 PASS: по 21 сценарию на 360×640, 390×844 и 412×915.
- `pnpm android:sync`, debug APK, release APK и AAB builds — PASS.

## Emulator QA

Статус: **NOT TESTED**.

В окружении отсутствовали emulator binary и AVD. Emulator screenshots не создавались.

## Physical Device QA

Статус: **PHYSICAL DEVICE QA REQUIRED**.

`adb devices -l` не обнаружил устройств. Установка APK, offline cold start, system UI, hardware/gesture Back, IME, lifecycle/process kill, update preservation и performance не объявляются пройденными. Полный ручной сценарий находится в `docs/android-device-qa.md`.

## Appendix A Android

Статус: **MANUAL REQUIRED**.

Полный Appendix A прошёл browser E2E на трёх viewport и тот же production bundle упакован в APK. Это не считается Android acceptance до прохождения пунктов 1–12 на установленном приложении.

## Screenshots

Android screenshots отсутствуют, потому что emulator/device недоступны. Browser evidence сохранён в существующих `docs/qa/*`; он не маркируется как Android screenshot. Правила будущего evidence описаны в `docs/qa/android/README.md`.

## Requirements

Матрица и traceability обновлены: packaging/build/audit имеют DONE, нативные interaction/lifecycle сценарии — PARTIAL или DEVICE QA REQUIRED, production signing — OWNER KEY REQUIRED. PWA shell отмечен N/A: устанавливаемым target выбран Capacitor Android wrapper.

## Security audit

- Нет hardcoded secrets, паролей, production keystore или private URL.
- Нет обязательного network runtime, analytics, Sentry/Firebase, рекламы или аккаунта.
- Cleartext traffic и Android backup отключены.
- Release artifacts не маскируются под подписанные: `apksigner`/`jarsigner` подтвердили отсутствие подписи.
- Bundle не содержит tests/docs/source maps; debug WebView выключен конфигурацией.

## Changed files

Основные изменения: `capacitor.config.ts`; `package.json`; `pnpm-lock.yaml`; `pnpm-workspace.yaml`; `apps/web/src/App.tsx`; `apps/web/src/application/native-shell.ts`; `apps/web/src/styles.css`; Android project/config/resources в `android/`; source branding в `resources/android/`; scripts `android-gradle.mjs`, `bootstrap-android-toolchain.ps1`, `prepare-android-assets.mjs`, `export-android-artifacts.mjs`; Android build/signing/QA/release/RuStore docs; README, requirements matrix и traceability; экспортированные artifacts и checksums.

## Remaining risks

1. Нет physical-device/emulator evidence; реальные WebView/system UI/lifecycle свойства остаются непроверенными.
2. Нет production keystore владельца; release APK/AAB нельзя публиковать.
3. Требования и поля кабинета RuStore могут измениться; перед submission нужна проверка актуальной формы и политики.
4. APK update preservation подтверждается только после установки сборок с последовательными versionCode на устройстве.

## Next step

**Этап 6 — physical-device acceptance → финальная signed сборка → RuStore submission package → документация → презентация 8–12 слайдов → backup video ≤3 мин.**
