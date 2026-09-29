# Матрица требований — после Этапа 5
Статусы: DONE — реализован заявленный объём строки; PARTIAL — только часть пользовательского требования; NOT STARTED — не начато; N/A — сознательно вне MVP/этапа. Подробные evidence: `docs/requirements-traceability.md`.

| Требование | Статус | Domain / application | Content | UI / следующий экран | Тест |
|---|---|---|---|---|---|
| Первый запуск, boot и onboarding | DONE | bootDestination, GameService.loadGame | interface.json | Onboarding, App guard | first-playable.test, E2E |
| Выбор реального питомца и доступного appearance | DONE | PetAppearance, createInitialProfile | registry petOptions | PetCreate | registry.test, E2E cat/dragon |
| Имя питомца 2–16 символов | DONE | PetNameSchema | — | PetCreate | name unit tests, E2E |
| Выбор первой цели | DONE | selectSavingsGoal, GameService.selectGoal | goals.json | GoalSelect | persistence, E2E |
| Восстановление Home при reload | DONE | StorageAdapter, GameService | — | Boot/Home | E2E all 3 widths |
| Динамический Home: wallet/savings/цель/состояние | DONE | GameProfile, calculateGoalProgress | interface.json, goals | Home, PetStatus, GoalCard | E2E 0/0 and 70/30 |
| Production art inventory и registry | DONE | — | 49 WebP из 41 PNG | PetImage, Art, Home | registry.test + images QA |
| Три стадии и эмоции в resolver | DONE | PetStage | cat/dragon assets | PetImage | registry.test |
| Настройки анимаций, reduced motion, повтор обучения | DONE | preferences local adapter | — | Settings | E2E |
| Звук | DONE | preferences + local Web Audio click | сеть/аудиофайлы не нужны | Settings switch | settings E2E |
| Навигация, Back, safe areas | DONE | route guards | interface navigation | BottomNavigation, headers | E2E 360/390/412 |
| Игровая валюта, отдельные wallet/savings | DONE | PERIOD_INCOME, Transaction, без двойного дохода | economy.json | DayStart, балансы | gameplay-domain, E2E |
| Активная часть периода PLANNING → ACTIVE | DONE | startPeriod/confirmBudgetPlan | economy.json | DayStart, Budget, Home | полный Stage 2 E2E |
| Budget Planner: черновик и immutable confirm | DONE | create/update/confirm | шаг 5, доход 100 | /budget: три категории, остаток, summary | domain/application/E2E |
| Plan != Actual, plannedSavings != savedActual | DONE | calculateBudgetActual из Transaction, activeDayPreview | — | компактный preview Home и Budget | domain/E2E 40/30, 30/35, 30/20 |
| Итог периода и финальный Plan vs Fact | DONE | closePeriod, snapshot, защита от двойного close | 3 приоритетных feedback codes | /day/result, реальные монеты и состояние | period-results, periods integration/E2E |
| Покупки 10 товаров двух категорий | DONE | executePurchase, periodId, PetState, history | purchases.json | /shop, подтверждение, feedback | domain/application/E2E |
| Попытка покупки при нехватке | DONE | INSUFFICIENT_FUNDS, профиль неизменен | реальные цена/остаток | объяснение суммы и К заданиям | E2E: игра 60 при wallet 35 |
| Накопления, preview и снятие с подтверждением | DONE | deposit/preview/withdraw, SAVINGS_* | goals.json | /savings, лимит суммы, отмена | application/E2E deposit/withdraw |
| Цель и реальный прогресс накопления | DONE | calculateGoalProgress/Remaining | три исходные цели | Savings + Home | E2E 20 / 200 |
| Шесть интерактивных финансовых заданий | DONE | evaluateTask + completeTask, reward once | исходные шесть definitions | общий TaskRenderer, 6 типов | domain + browser interaction каждого типа |
| Последствия решений и восстановление | DONE | рассчитанные суммы симуляций, error mapping | feedback/recovery/templates | task-feedback, shortage, preview | неудачный выбор → исправление → reward |
| Сохранение каждого финансового действия | DONE | GameService atomic commit → StorageAdapter | — | busy, результат только после save | reload после каждого шага, save failure |
| Шесть определений событий, минимум 3 в игре | DONE | resolveDecisionEvent, одно решение/период, EVENT_* | 6 definitions, последовательность 2/3/4 | EventCard, бонус/скидка/уход | integration + E2E |
| Реальные изменения PetState и краткая реакция | DONE | эффекты покупки с clamp 0–100 | happy cat, idle fallback dragon | Home meters, feedback pet | domain/E2E satiety 100, mood 90 |
| Развитие питомца по серии периодов, 3 стадии | DONE | четыре cumulative signals, пороги 3/750 и 5/1400, monotonic | stage assets и evolution texts | Evolution, Home по semantic stage | 5-period integration/E2E, weak-day regression |
| История и LearningProgress | DONE | immutable result snapshots, existing topic counters | позитивные статусы | Progress, история, старые результаты по id | snapshot/reload integration + E2E |
| Взрослый раздел | DONE | reset/delete lifecycle, LearningProgress | образовательные/privacy тексты | `/adult`, `/adult/dashboard`, long press | Appendix A + reset/delete E2E |
| Demo Mode UI | DONE | separate namespaces, deterministic reset/exit | guidance существующего сценария | onboarding, badge, Settings | namespace/integration + Demo E2E |
| Полный конкурсный gameplay | DONE | полный пятидневный локальный цикл | существующий контент | Appendix A 1–12 + Adult + Demo | отдельный `appendix-a.spec.ts` |
| Offline runtime без backend | DONE | localStorage | assets bundled locally | web через локальную раздачу | E2E blocks external/API |
| Android Capacitor offline wrapper | DONE | bundled production web assets, localStorage | весь контент локальный | native WebView, portrait | sync/build/package audit |
| Android Back и system UI integration | PARTIAL | modal → history → exit; SystemBars/safe-area config | — | native shell | implementation/build PASS; device QA required |
| Устанавливаемый debug APK | PARTIAL | debug-signed artifact собран | — | Android 8+ | build/signature audit PASS; install QA required |
| Release APK/AAB | PARTIAL | unsigned artifacts и env-based signing pipeline | — | publication artifacts | build/zipalign/package audit PASS; owner signing required |
| PWA offline shell | N/A | Android wrapper выбран как устанавливаемый target Этапа 5 | — | — | вне объёма |
| API / cloud sync | N/A | optional future, не MVP | — | — | вне объёма |

| Требование Этапа 3 | Статус | Реализация | Проверка |
| --- | --- | --- | --- |
| Минимум 5 последовательных периодов | DONE | мгновенный следующий день без таймера | полный UI-сценарий × 3 viewport |
| Persistence между периодами | DONE | wallet carry-over, savings/goal/history/progress, schema v2 migration | reload после каждого результата и обоих evolutions |
| Достижение цели и выбор следующей | DONE | celebration, achievedGoalIds, без автоматического списания | integration и E2E, сохранение 200 при новой цели |
| Эволюция без зависимости от анимации | DONE | текстовая стадия, assets, reduced-motion | browser и asset registry |

| Требование Этапа 5 | Статус | Реализация | Проверка |
| --- | --- | --- | --- |
| Package/app/version | DONE | `ru.onesolution.finni`, «Финни», 1.0.0 (1) | `apkanalyzer` + `aapt` |
| Android SDK range | DONE | minSdk 26, target/compileSdk 36 | manifest/package audit |
| Production bundle без dev server | DONE | `webDir: apps/web/dist`, нет `server.url` | `cap sync` + bundle audit |
| Offline runtime composition | DONE | 55 bundled web files, без remote assets/API | archive/URL audit + browser offline E2E |
| Icon и splash resources | DONE | source/adaptive icon/splash сгенерированы из утверждённого art | source/generated visual audit; device display manual |
| Permissions и transport hardening | DONE | INTERNET удалён, cleartext/backup запрещены | merged manifest audit |
| Signing infrastructure | DONE | четыре `FINNI_RELEASE_*` env vars, fail-fast partial config | Gradle release build; production key не входит в repo |
| Native persistence acceptance | PARTIAL | WebView localStorage и lifecycle-safe web operations | browser reload PASS; pause/kill/update device QA required |
| Appendix A / Demo / Adult на Android | PARTIAL | один production bundle в APK | browser 63/63 PASS; installed APK manual required |
| Physical device / emulator acceptance | NOT STARTED | device checklist подготовлен | устройство, emulator и AVD отсутствовали |
