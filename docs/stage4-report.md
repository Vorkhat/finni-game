# Этап 4 — Demo Mode, Adult Section, Appendix A и финальная UX-полировка

Этап завершён 15 сентября 2026. Android/Capacitor не начинались. Архитектура сохранена: UI → GameService → Shared Domain → StorageAdapter → localStorage.

## Demo Mode

Вход доступен secondary action на onboarding и из Settings. При существующем обычном профиле показывается подтверждение, что текущая игра сохранится. Normal и demo не копируют друг друга и хранятся независимо:

- `finni.game-profile` — обычная игра;
- `finni.demo-profile` — детерминированная демо-игра;
- `finni.profile-mode` — только указатель активного режима.

Demo использует существующие `createDemoProfile()` и `resetDemoProfile()`, поддерживаемого рыжего кота и те же UI-команды/доменные операции. Badge «Демо» и короткая контекстная подсказка показывают следующий шаг. Из Settings доступны «Начать демо заново» и «Выйти из демо». Reset создаёт строго одинаковый снимок; exit снова загружает normal profile. Integration и E2E подтверждают неизменность wallet, savings, pet, stage, goal, period и history обычной игры.

## Appendix A

| № | Обязательный пункт | Результат |
|---:|---|---|
| 1 | Запуск и introduction с Нужно/Хочу/Коплю | PASS |
| 2 | Локальный профиль без регистрации и PII | PASS |
| 3 | Выбор и имя питомца | PASS |
| 4 | Home: стартовый budget, goal, tasks, Финни | PASS |
| 5 | План Нужно/Хочу/Коплю до расходов | PASS |
| 6 | Интерактивное решение, feedback, reward | PASS |
| 7 | Нужная/желательная покупка и недостаток средств | PASS |
| 8 | Выбор цели и реальный savings deposit | PASS |
| 9 | Баланс, Plan vs Fact, feedback, PetState | PASS |
| 10 | Следующий период, PetProgress, обе stage progression | PASS |
| 11 | Reload восстанавливает состояние | PASS |
| 12 | Adult progress/info/reset/delete | PASS |

## Adult Section

`/adult` отделён от детского gameplay. Gate требует удерживать кнопку 3 секунды, показывает progress, отменяется при отпускании и поддерживает pointer/touch, Space и Enter. Прямой `/adult/dashboard` без gate возвращает на `/adult`.

Dashboard показывает завершённые периоды, стадию Финни, задания, три LearningProgress-темы с позитивными статусами, текущую цель, накопления и три последних результата. Блок «Чему учит Финни» объясняет планирование, нужное/желаемое, накопления и последствия решений. Короткий information block фиксирует игровую валюту, отсутствие платежей/рекламы/PII, локальное хранение и offline core loop.

Reset и Delete разделены. Reset создаёт новый initial profile с тем же выбранным образом/именем питомца, но без монет, цели, периодов и истории. Delete удаляет normal и неактивный demo save и после reload оставляет onboarding. В активном demo delete удаляет только demo и возвращает normal profile.

## UX audit

- Guard закрывает отсутствующий profile, result без completed/active period, evolution без stage change и adult dashboard без gate.
- Browser Back не запускает финансовые команды: доход, покупки, deposit и finish вызываются только явными CTA; уже существующие Back/reload assertions сохранены.
- Native dialogs получили focus/restore, Escape, semantic dialog/alertdialog roles, видимую destructive action и viewport-constrained scrolling.
- Safe-area padding сохранён для setup/game/adult screens и нижней навигации; основные экраны проверены на 360×640, 390×844 и 412×915.
- Home сохранил Финни визуальным центром; итог дня явно подписывает план/факт; evolution объясняет рост через серию решений.
- Реальный локальный click sound подключён к существующему switch; reduced motion имеет приоритет.

## Empty/error states

Обработаны отсутствие history, active period и goal, нулевые wallet/savings, достигнутая цель, неизвестное задание и все шесть завершённых заданий. Для полного набора заданий показано позитивное завершение без обещания нового контента. Старый period без snapshot использует детский текст без технических терминов.

Solid `ErrorBoundary` показывает безопасный экран «Что-то пошло не так», пишет техническую ошибку только в dev console и предлагает Home. Ошибка чтения/migration не очищает storage: recovery предлагает retry либо отдельное подтверждение удаления повреждённого save.

## Persistence

Normal save, demo save, mode selection, demo reset/exit, normal reset/delete и v1/versionless → v2 migration работают через существующий StorageAdapter. Финансовый commit по-прежнему сначала сохраняет полный профиль и лишь затем публикует его в UI. Schema остаётся v2.

## Privacy

Source/UI audit обязательного пути не нашёл полей real name, surname, phone, email, birthday, address, account или password. Единственное упоминание телефона/email находится в Adult Section и прямо сообщает, что эти данные не требуются. Допустимое поле — только nickname питомца.

## Network audit

Поиск по runtime source не нашёл `http(s)`, `fetch`, XHR, WebSocket, CDN, analytics или remote CSS imports. Все E2E перехватывают запросы: разрешён только `http://127.0.0.1:4173`, любой другой origin и `/api` считается ошибкой. Результат полного прогона: 0 внешних/API запросов.

## Accessibility

Проверены accessible names, semantic buttons/links, form label имени питомца, progress labels, native dialogs, destructive alertdialogs, initial modal focus, Escape, keyboard fallback long press, cancellation, visible focus, 48px minimum controls, reduced motion и отсутствие зависимости смысла только от цвета.

## Tests

`pnpm test`: **74/74 PASS**, 11 test files. Было 71; добавлены namespace/lifecycle tests Demo/reset/delete.

## E2E

`pnpm e2e`: **63/63 PASS** за 3,1 минуты, один worker, production preview. Было 48; добавлены 15 проверок (5 сценариев × 3 viewport): Appendix A, Demo isolation, Adult reset, Adult delete, corruption recovery/direct guards/modal focus/Escape.

## Appendix A E2E

`e2e/appendix-a.spec.ts` содержит один полный fresh-launch сценарий: onboarding → pet → goal → пять реальных периодов → task/purchases/shortage/savings → Plan vs Fact/PetState → EXPLORER → FINNI_PRO → reload → Adult Section. На 390×844 он проходит за 17,1 секунды автоматизированного времени. Дополнительные isolated tests проверяют Demo reset/exit, фактические reset/delete и recovery.

## Screenshots

Все обязательные файлы находятся в `docs/qa/stage4/`:

- `demo-entry-390.png`, `demo-guidance-390.png`;
- `adult-gate-390.png`, `adult-dashboard-390.png`, `adult-learning-390.png`;
- `reset-confirm-390.png`, `delete-confirm-390.png`;
- `appendix-home-390.png`, `appendix-budget-390.png`, `appendix-shop-390.png`, `appendix-insufficient-390.png`, `appendix-savings-390.png`, `appendix-result-390.png`, `appendix-evolution-390.png`;
- `final-home-360.png`, `final-home-390.png`, `final-home-412.png`.

## Requirements

Основная `docs/requirements-matrix.md`: **35 DONE, 0 PARTIAL, 1 NOT STARTED, 1 N/A**. Единственный NOT STARTED — устанавливаемая PWA/Android оболочка, сознательно отложенная. Детальная Stage 4 traceability: **30 DONE, 0 PARTIAL, 2 NOT STARTED, 1 N/A**; два NOT STARTED отдельно учитывают PWA shell и Android release.

## Changed files

- Application/persistence: `game-context.tsx`, `game-service.ts`, `storage.ts`, `preferences.ts`.
- UI: `App.tsx`, `index.tsx`, `Onboarding.tsx`, `Settings.tsx`, новый `Adult.tsx`, `Home.tsx`, `Tasks.tsx`, `PeriodResult.tsx`, `Evolution.tsx`, `ui.tsx`, `gameplay.tsx`, новый `demo.tsx`, новый `stage4.css`.
- Domain: детерминированный demo appearance в `packages/shared/src/economy.ts`.
- Tests: storage/lifecycle tests, новый `e2e/appendix-a.spec.ts`, актуализирован evolution guard regression.
- Docs: README, architecture/data model, matrix/traceability, demo script/backup, checklist и этот отчёт.

## Remaining risks

- PWA offline shell отсутствует; это не блокирует текущий local runtime и будет заменено Capacitor packaging.
- Android portrait lock, metadata, permissions, icon/splash, физическое устройство и signed APK/AAB ещё не проверены.
- Межвкладочная синхронизация и cloud backup сознательно вне MVP.
- Vite CJS deprecation warning остаётся non-blocking: lint/test/build/runtime не затронуты; рискованный dependency upgrade перед релизом не выполнялся.

## Quality gate

- `pnpm lint` — PASS.
- `pnpm test` — 74/74 PASS.
- `pnpm build` — PASS, 79 modules transformed.
- `pnpm e2e` — 63/63 PASS.
- Production preview, Appendix A, Demo isolation, no-console-error hooks и zero-external-request guards — PASS.

## Next step

**Этап 5 — Capacitor Android → portrait → app metadata/icon/splash → offline APK → physical-device QA → signed release APK/AAB.**
