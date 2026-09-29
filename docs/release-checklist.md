# Release checklist — Android 1.0.0

Статусы относятся к артефактам Этапа 5. Browser QA подтверждает игровую логику, но не заменяет проверку установленного APK.

## Automated и build gates

- [x] `pnpm lint` — PASS.
- [x] `pnpm test` — 74/74 PASS.
- [x] `pnpm build` — PASS.
- [x] `pnpm e2e` — 63/63 PASS на 360×640, 390×844 и 412×915.
- [x] `pnpm android:sync` — PASS; production bundle скопирован в Android.
- [x] Gradle debug APK — PASS.
- [x] Gradle release APK и AAB — PASS, оба unsigned.
- [x] APK zipalign, package/version/SDK и manifest audit — PASS.
- [x] Runtime bundle audit: нет source maps, tests, docs, QA или исходников TypeScript.

## Physical-device acceptance

- [ ] Установка APK — `PHYSICAL DEVICE QA REQUIRED`.
- [ ] Полный offline запуск и gameplay в airplane mode — `PHYSICAL DEVICE QA REQUIRED`.
- [ ] Background/resume, force-stop/process kill и сохранение после update — `PHYSICAL DEVICE QA REQUIRED`.
- [ ] Android Back для dialog, вложенных экранов и Home — `PHYSICAL DEVICE QA REQUIRED`.
- [ ] Клавиатура/`adjustResize`, touch, scroll и long press — `PHYSICAL DEVICE QA REQUIRED`.
- [ ] Safe areas, status/navigation bars, вырезы и gesture bar — `PHYSICAL DEVICE QA REQUIRED`.
- [ ] Demo isolation/reset/exit — `PHYSICAL DEVICE QA REQUIRED`.
- [ ] Appendix A 1–12 на APK — `PHYSICAL DEVICE QA REQUIRED`.
- [ ] Adult gate/reset/delete — `PHYSICAL DEVICE QA REQUIRED`.
- [ ] Launcher icon и splash на реальном launcher/startup — `PHYSICAL DEVICE QA REQUIRED`.

## Security и publication

- [x] Permission audit: нет INTERNET, storage, location, camera, contacts, microphone, ads/analytics permissions.
- [x] `allowBackup=false`, `usesCleartextTraffic=false`, portrait, minSdk 26, targetSdk 36.
- [x] Debug APK подписан Android Debug certificate и предназначен только для QA.
- [ ] Владелец создал и безопасно сохранил production keystore.
- [ ] Release APK/AAB подписаны постоянным ключом владельца и повторно проверены `apksigner`/`jarsigner`.
- [ ] `versionCode` увеличен для каждой следующей публикации.
- [ ] RuStore кабинет, карточка, возрастная маркировка, политика и итоговая загрузка — следующий этап.

Итог Этапа 5: сборочный pipeline и unsigned release artifacts готовы; публикационный релиз блокируют production signing и physical-device acceptance.
