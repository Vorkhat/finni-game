# Модель данных

Назначение: структура `GameProfile`, связи сущностей и версии схемы хранения.

## Содержание

- [Связи](#связи)
- [Сущности](#сущности)
- [Хранение (этап 4)](#хранение-этапа-4)
- [Расширения этапа 1](#расширения-этапа-1)
- [Расширения этапа 2](#расширения-этапа-2)
- [Расширения этапа 3](#расширения-этапа-3--schemaversion-2)

## Связи

```text
GameProfile
├── Pet ── PetAppearance + PetState + PetProgress + PetStage
├── currentPeriod: GamePeriod | null
├── periodHistory: GamePeriod[]
├── transactions: Transaction[]
├── completedTasks[] + LearningProgress
└── selectedGoalId → SavingsGoalDefinition (content)

GamePeriod
├── BudgetPlan (намерение, immutable после confirm)
├── BudgetActual (расчёт из Transaction[])
├── TaskResult[]
└── PeriodResult (сравнение, score, feedback codes, pet changes)
```

## Сущности

- `GameProfile` — корень локального состояния: идентификаторы, питомец, отдельные балансы wallet/savings, текущий и завершённые периоды, транзакции, обучение, demo-флаг, timestamps и `schemaVersion`.
- `Pet` — имя, вид и комбинируемый внешний вид (`species × colorVariant × accessoryVariant`), обратимое состояние, монотонная стадия и накопительный прогресс.
- `GamePeriod` — один финансовый цикл со статусами `PLANNING → ACTIVE → COMPLETED`, доходом, планом, фактом, действиями и итогом.
- `BudgetPlan` — planned mandatory/optional/savings, нераспределённый остаток и подтверждение. Доход не перемещается в savings автоматически.
- `BudgetActual` — реальные обязательные и необязательные траты, реальные накопления, дополнительный заработок и доступный остаток; вычисляется из журнала операций.
- `Transaction` — неизменяемое объяснение денежного движения: тип, положительная сумма, источник, категория, период, время и metadata.
- `SavingsGoalDefinition` — контентная цель с ценой; профиль хранит только выбранный id и текущий savings balance.
- `LearningTaskDefinition` — интерактивное определение либо legacy-вопрос для прежних клиентов ядра. `TaskResult` хранит результат конкретного периода.
- `LearningProgress` — счётчики попыток, завершений, удачных решений и изученных последствий по трём темам без школьных оценок.
- `PeriodResult` — сохранённый результат для UI: plan-vs-actual, выполнение важных нужд, регулярность накоплений, задания, score, изменения питомца и коды обратной связи.

## Хранение Этапа 4

Схема `GameProfile` не менялась и остаётся v2. Изоляция Demo Mode реализована не вложенным backup-полем, а двумя полными документами одинаковой схемы:

```text
finni.game-profile  → normal GameProfile
finni.demo-profile  → demo GameProfile (demoMode=true)
finni.profile-mode  → "demo" или отсутствие ключа
```

Так reset/delete активного demo документа не может изменить wallet, savings, pet, stage, goal, period или history normal документа. Adult reset создаёт новый валидный initial profile с выбранным образом и именем питомца, но с нулевыми балансами, без цели и истории. Adult delete удаляет профиль целиком; при удалении normal profile очищается также неактивное демо.

## Расширения Этапа 1

- Имя нового питомца валидируется `PetNameSchema`: trim, 2–16 символов, без управляющих символов. `playerNickname` остаётся «Гость», настоящее имя ребёнка не запрашивается.
- Реальные `PetAppearance`: `cat/ginger/green-scarf` и `dragon/turquoise/gold-medallion`. Цвет не смешивается с эмоцией или стадией.
- В новых покупках обязателен `assetId`; в целях — `description` и `assetId`. На границе content используется усиленная версия общей схемы, legacy доменные fixtures остаются совместимыми.
- `InteractiveLearningTaskDefinition`: id/topic/type/title/intro/assetId/initialState/actions/successConditions/reward/feedback/educationalGoal/recovery. Начальное состояние и условия симуляции валидируются; ссылки actions → feedback проверяются. Обычные quiz сохранены только как legacy-контракт ядра Этапа 0.
- `DecisionEventDefinition`: `kind: decision`, тип события, context, choices и feedback. Исполнение событий пока не входит в UI; это не непосредственные транзакции.
- `schemaVersion` профиля остаётся 1: его persisted-структура не менялась. Изменён контентный каталог целей. Неизвестный старый goalId предлагает новый выбор, сохраняя wallet/savings.

## Расширения Этапа 2

- `TaskSubmission`: actionId и, по механике, allocations либо selectedItemIds. Форма строго проверяется Zod; неизвестные действия, чужие товары, дубликаты в корзине и недопустимые суммы отвергаются.
- `evaluateTask` возвращает disposable simulation result: кошелёк истории, накопления истории, стоимость корзины, покрытые нужные покупки, распределение, расстояние до цели, успешность и feedback. Это не второй GameProfile и не второе хранилище настоящих денег.
- `DecisionAction.retryFeedbackCode` необязателен и ссылается на существующий feedback. Шаблоны последствий корзины заполняются фактическими суммами выбранного сочетания, а не заранее записанным примером.
- `completeTask` принимает также TaskSubmission. Успешный результат обновляет CompletedTask, TaskResult, LearningProgress и TASK_REWARD. Исследование неудачных вариантов остаётся временной симуляцией; отдельные клики/черновики задания после reload не восстанавливаются. Уже выданная награда и завершение восстанавливаются.
- `EconomyConfig`: periodIncome=100, budgetStep=5, quickAmounts=[10,20,30], валидируемый контент. Доменные функции по-прежнему допускают configurable income.
- `PERIOD_INCOME.source` теперь `period_income`, periodId остаётся отдельным полем; прежние сохранённые source читаются без миграции.
- Persisted-структура профиля не изменилась; schemaVersion остаётся 1. Этап 2 не удаляет и не сбрасывает сохранения Этапа 1.

## Расширения Этапа 3 — schemaVersion 2

- `GamePeriod.mandatoryNeeds`: список нужд `{ id, purchaseIds[] }`, любой purchaseId покрывает соответствующую нужду. Список фиксируется на старте. Legacy-дни получают `[]` и используют денежный fallback.
- `GamePeriod.eventDecisions`: `{ eventId, choiceId }[]`. Сохраняет также пропуски; защищает повторное применение независимо от transactionId.
- `GamePeriod.evolutionSeen`: просмотр изменения стадии подтверждён. При реальном новом stage change false; кнопка celebration сохраняет true. Legacy-дни получают true, чтобы не проигрывать старые достижения заново.
- `PeriodResult.snapshot`: `{ walletBalance, savingsBalance, selectedGoalId, petState, petProgress }` на момент закрытия. Stage хранится в существующем petStageChange. История читает snapshot и planVsActual, никогда не подставляет текущее состояние профиля. Новые snapshots обязательны в closePeriod; для старых сохранений значение null, UI честно поясняет отсутствие исторического состояния/копилки.
- `GameProfile.achievedGoalIds`: подтверждённые достижения целей; default `[]`. Смена цели остаётся отдельной явной командой и не тратит накопления.
- `EVENT_EXPENSE` для покупок хранит category MANDATORY/OPTIONAL и metadata `{ eventId, purchaseId, regularPrice }`, поэтому входит в соответствующий Actual и покрытие нужд. Денежная запись бонуса — EVENT_REWARD. Для skip денежной записи нет.
- PetProgress не заменён: используются прежние пять полей, новая параллельная модель не создана. Пути к asset не сохраняются; profile хранит semantic species/appearance/stage.

Явная migration `migrateProfile`: versionless и v1 → v2 через schema defaults новых полей; существующие wallet, savings, history, goal, state и progress сохраняются. Неизвестная версия отвергается. Данные читаются без очистки localStorage; при следующем успешном save записывается v2. Старые результаты не пересчитываются по новым порогам и правилам.
