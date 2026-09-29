# Changelog

Все значимые изменения проекта «Финни». Формат — [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/),
версионирование — [Semantic Versioning](https://semver.org/lang/ru/).

## [Unreleased]

### Added

- `docs/README.md` — индекс документации; `docs/getting-started.md` — запуск; `docs/api.md` — контракты домена.
- `CHANGELOG.md` и `CONTRIBUTING.md`.

### Changed

- `README.md` приведён к форме standard-readme; инструкции локального запуска сохранены дословно.
- `DOCUMENTATION.md` сокращён до короткого индекса со ссылками в `docs/`.
- `docs/deployment.md` дополнен подписью release, паспортом RuStore и чек-листом релиза.
- `docs/requirements.md` дополнен трассировкой Appendix A и Android acceptance.

### Removed

- Отчёты этапов `docs/stage1-report.md` … `docs/stage6-report.md` и `FINAL_QA_REPORT.md`.
- QA-материалы `docs/qa/**` (более 290 скриншотов); оставлены шесть ключевых экранов в `docs/assets/`.
- Устаревшие документы `docs/android-signing.md`, `docs/android-device-qa.md`, `docs/release-checklist.md`,
  `docs/requirements-traceability.md`, `docs/rustore-technical.md`, `docs/PROGRAM_CONTENT.md`,
  `docs/home-ux-audit.md`; полезное содержимое перенесено в тематические файлы.

## [1.0.0] — 2026-09-25

### Added

- Офлайн-игра по финансовой грамотности «Финни» для детей 7–11 лет: 10 игровых дней,
  20 заданий (T01–T20), 60 ситуаций (S01–S60), три цели и три стадии развития питомца.
- Монорепозиторий pnpm: SolidJS-приложение (`apps/web`), домен и Zod-схемы (`packages/shared`),
  контент (`packages/content`) и заготовка API (`apps/api`).
- Android-обёртка Capacitor 8 (`android/`) со сборкой debug и release APK/AAB.
- CI-джоб «Verify Finni»: тесты, coverage и Playwright E2E.
- Консолидированная документация в `docs/`.

[Unreleased]: https://github.com/Vorkhat/finni-game/compare/51b37ac...HEAD
[1.0.0]: https://github.com/Vorkhat/finni-game/releases/tag/v1.0.0
