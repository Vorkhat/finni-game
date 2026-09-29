# Этап 4 — итоговый checklist

Создан до внесения изменений; закрыт после полного quality gate.

## Demo Mode

- [x] Secondary entry на onboarding и безопасное подтверждение при normal profile.
- [x] Раздельные localStorage namespaces normal/demo; переключение не меняет normal save.
- [x] Детерминированные `createDemoProfile` / `resetDemoProfile`, reset без мусора.
- [x] Badge «Демо», guidance, restart и exit из Settings.
- [x] Быстрые последовательные периоды без таймеров и автоматизации решений.
- [x] Unit/integration/E2E изоляции normal → demo → reset → exit.

## Appendix A

- [x] Все 12 шагов доступны через UI, включая Plan vs Fact, PetState/Progress и reload.
- [x] Один сквозной `appendix-a.spec.ts`, отдельные reset/delete/demo-isolation проверки.
- [x] Обязательные, необязательные и недоступные покупки реально выполняются пользователем.

## Adult Section

- [x] `/adult` с доступным long press (pointer/touch/keyboard, progress, cancel).
- [x] Guard `/adult/dashboard` без успешного gate.
- [x] Прогресс, темы LearningProgress, цель, последние результаты.
- [x] «Чему учит Финни» и короткий privacy/offline блок.
- [x] Раздельные reset progress и delete profile с подтверждением.

## UX и устойчивость

- [x] Guards для отсутствующего profile/result/evolution и безопасный unknown route.
- [x] Browser Back и modal flow не повторяют финансовые операции.
- [x] Focus/Escape/dialog roles/touch targets/mobile height для всех modal.
- [x] Completed-tasks, no-history, no-period, no-goal, zero-wallet/savings empty states.
- [x] Старые period snapshots объяснены детским языком.
- [x] Global ErrorBoundary с безопасным fallback и console error.
- [x] Corrupt-storage recovery: retry или явно подтверждённая новая игра, без silent delete.
- [x] Settings без fake controls; tutorial replay не меняет профиль; sound реально подключён.
- [x] Safe areas, reduced motion, overflow и 360/390/412 visual pass.

## Документация и качество

- [x] `docs/demo-script.md`, `docs/demo-backup.md`.
- [x] `docs/requirements-traceability.md`, актуальная requirements matrix.
- [x] `docs/stage4-report.md` с честными статусами и remaining risks.
- [x] Все обязательные screenshots в `docs/qa/stage4/`.
- [x] PII source/UI audit и external-network audit.
- [x] `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm e2e` PASS.
- [x] Production preview без console errors; Android/PWA/cloud/tab-sync не начаты.
