# Документация проекта «Финни»

Консолидированная документация игры по финансовой грамотности для детей 7–11 лет.
Собрана из материалов каталога `project/docs` и корневого `README.md`.

## Содержание

- [Обзор проекта](#обзор-проекта)
- [Архитектура](#архитектура)
- [Стек технологий](#стек-технологий)
- [Структура репозитория и запуск локально](#структура-репозитория-и-запуск-локально)
- [Развёртывание](#развёртывание)
- [API и модель данных](#api-и-модель-данных)
- [Контент и экономика](#контент-и-экономика)
- [Требования задачи](#требования-задачи)
- [Демо-сценарий](#демо-сценарий)
- [Известные ограничения](#известные-ограничения)

## Обзор проекта

«Финни» — офлайн-игра, которая учит ребёнка распоряжаться ограниченным доходом:
отделять важные траты от желаний, копить на цель и видеть последствия решений.
Игровой цикл полностью локальный и **не требует backend, регистрации и сети**:
профиль хранится в `localStorage` браузера (или WebView на Android).

Текущая программа:

- 10 игровых дней по 30 минут реального времени; в каждом дне 2 задания (T01–T20)
  и 6 ситуаций (S01–S60);
- цели стоимостью 200 / 300 / 500 монет (самокат, домик, космическое путешествие);
- питомец взрослеет по ходу программы: подросток после 4 завершённых дней,
  взрослый — после 8, финал — после завершения всей программы;
- после программы доступны уход, накопления, повторные прохождения наборов
  и личные мечты.

Что показывает игра: первый запуск и выбор питомца, выбор первой цели, планирование
бюджета дня, покупки и копилку, учебные задания и жизненные ситуации, результат дня,
развитие питомца, раздел для взрослых и демонстрационный режим.

> Исторические отчёты в `project/docs` (stage1–stage6, `FINAL_QA_REPORT.md`) описывают
> более ранний цикл из 6 заданий / 30 ситуаций и 5 периодов. Текущее расписание —
> 10 дней / 20 заданий / 60 ситуаций (см. `project/docs/PROGRAM_CONTENT.md`).

## Архитектура

Основной runtime (без обязательного backend):

```text
UI (SolidJS screens/components)
          ↓
GameService (apps/web application layer)
          ↓
Shared Domain (packages/shared)
          ↓
StorageAdapter (apps/web)
          ↓
Local Storage

packages/content ── definitions ──→ application/domain
apps/api ── optional future infrastructure; not in the gameplay path
```

**Обязательный игровой цикл не имеет зависимости от backend.**

- UI отвечает за отображение и команды пользователя и не пересчитывает экономику.
- `GameService` последовательно вызывает доменные операции и сохраняет новый снимок
  профиля. Финансовых формул в нём нет.
- `packages/shared` не импортирует SolidJS, браузерные API или backend-код: операции
  получают состояние и команду и возвращают новое состояние либо `DomainError`.
- Источник истины: бизнес-правила, инварианты, расчёт результата периода и прогресс
  питомца — `packages/shared`; контент и детские тексты — `packages/content`;
  оркестрация и локальный adapter — `apps/web/src/application`.

### Persistence и версии

`StorageAdapter` определяет `loadProfile`, `saveProfile`, `deleteProfile`,
`resetProfile`, `hasProfile`. Основная реализация использует `localStorage`,
тестовая — память. При загрузке вызывается `migrateProfile`: versionless и v1 → v2
через schema defaults, существующие wallet, savings, history, goal, state и progress
сохраняются. Неизвестная или повреждённая структура возвращает `INVALID_PROFILE`
и не попадает в игру.

Этап 4 разделяет физическое хранение: `finni.game-profile` для обычной игры и
`finni.demo-profile` для демо. Ключ `finni.profile-mode` содержит только активный
режим; переключение создаёт новый `GameService` над нужным namespace, обычный снимок
не копируется и не перезаписывается.

### Безопасность состояния

Компоненты не меняют профиль напрямую: все денежные команды проходят через доменные
операции, проверяют остатки и создают `Transaction`. Подтверждённый план заменять
нельзя. `GameService.commit` сначала сохраняет профиль, затем публикует состояние,
поэтому ошибка `localStorage` не выдаёт несохранённый профиль за успешный; параллельные
сохранения блокируются, повторный `transactionId` и повторная награда отвергаются.
Все `DomainError` централизованно преобразуются в `error-messages.ts`.

### Игровой цикл

- `/day/start` объясняет доход из `packages/content/economy.json`; команда начала
  вызывается только по нажатию, reload не начисляет доход повторно.
- `/budget` хранит черновик плана, после `confirmPlan` работает read-only; каждая
  часть плана — целое неотрицательное число, сумма не превышает доход периода.
- `/shop`, `/savings`, `/tasks`, `/progress`, `/day/result` используют доменные
  операции preview/confirm; `evaluateTask` — чистая функция shared.
- `/day/result` вызывает `closePeriod`: сравнение план/факт, четыре сигнала, score,
  изменения питомца и сохранённый snapshot результата — одной атомарной записью.
- Следующий день доступен сразу, без часов, календаря и серверных timestamps.
- Demo Mode использует те же UI-команды и операции, но отдельное хранилище.

## Стек технологий

| Слой | Технологии |
|---|---|
| Язык | TypeScript 5.6 |
| UI | SolidJS 1.9, `@solidjs/router` 0.15 |
| Сборка | Vite 5 + `vite-plugin-solid`; монорепозиторий pnpm (pnpm 11.19.0, Node.js 24) |
| Валидация | Zod 3 (`packages/shared`) |
| Тесты | Vitest 2 (unit/integration), Playwright (E2E) |
| Android | Capacitor 8 + Gradle; JDK 21, Android SDK Platform 36, minSdk 26 |
| Заготовка API | NestJS 10 + Swagger; в игровой runtime не входит |
| Хранение | `localStorage` / WebView `localStorage` |
| Звук и анимации | локальные MP3 и Web Audio; CSS transforms/opacity, без анимационных библиотек |

## Структура репозитория и запуск локально

```text
Finni-2026-09-25/
├── README.md                  # краткая инструкция по передаче и запуску
├── DOCUMENTATION.md           # этот файл
├── START_GAME_WINDOWS.cmd     # запуск готовой игры на Windows без Node.js
└── project/
    ├── apps/
    │   ├── web/               # SolidJS-приложение: src, public, собранный dist
    │   └── api/               # заготовка NestJS API (Dockerfile + main.ts), не в gameplay
    ├── packages/
    │   ├── shared/            # домен, Zod-схемы, экономика, периоды, развитие питомца
    │   ├── content/           # JSON/TS-контент: задания, ситуации, цели, товары, экономика
    │   └── config/            # общие конфиги
    ├── android/               # Capacitor Android-проект
    ├── e2e/                   # Playwright-сценарии
    ├── scripts/               # сборка, portable-сервер, ассеты, Android
    ├── docs/                  # документация, отчёты этапов, QA-материалы
    ├── capacitor.config.ts
    ├── docker-compose.yml     # опциональный локальный API-стаб
    ├── pnpm-workspace.yaml
    └── package.json
```

### Запуск готовой игры (Windows, без Node.js)

1. Полностью распакуйте ZIP в обычную папку (не запускайте внутри архива).
2. Дважды нажмите `START_GAME_WINDOWS.cmd`.
3. Игра откроется в браузере по адресу `http://127.0.0.1:18765`.

Скрипт использует встроенный PowerShell и браузер; Node.js, pnpm, API и интернет не
нужны. Не открывайте `index.html` двойным щелчком — игра использует маршруты и должна
открываться через локальный сервер.

### Запуск для разработки

Проверено с Node.js 24 и pnpm 11.19.0. Из каталога `project`:

```sh
npm install -g pnpm@11.19.0
pnpm install --frozen-lockfile
pnpm lint      # tsc --noEmit по всем пакетам
pnpm test      # Vitest по shared/content/web + node --test
pnpm build     # lint + tsc API + vite build в apps/web/dist
pnpm dev       # dev-сервер Vite
pnpm e2e       # build + Playwright
pnpm preview   # frontend preview на http://127.0.0.1:4173
```

Сборка Android: `pnpm android:build` (пересобирает веб-версию, выполняет `cap sync
android` и собирает debug APK в `artifacts/android/Finni-1.0.0-debug.apk`).
Требуются JDK 21 и Android SDK; подробности — `project/docs/android-signing.md`.

## Развёртывание

**Веб-версия** разворачивается как статический сайт:

1. `pnpm build` формирует `project/apps/web/dist`.
2. Содержимое `dist` копируется в корень сайта.
3. Настраивается SPA fallback: маршруты вида `/home`, `/tasks` должны возвращать
   `index.html`, а существующие `/assets/` — отдаваться как файлы.
4. Размещение в подпапке требует отдельной настройки базового пути.
5. Backend и база данных для игры не нужны.

Локальная проверка production-сборки — `pnpm preview` (Vite preview, порт 4173).
`docker-compose.yml` поднимает локальный API-стаб на `127.0.0.1:3000` для разработки
и не участвует в игровом пути.

**Android** — устанавливаемое приложение на базе Capacitor:

- debug APK собирается командой `pnpm android:build`;
- release APK/AAB — `pnpm android:release` (артефакты формируются unsigned);
- подпись release выполняется только постоянным ключом владельца; в репозитории
  ключей и учётных данных нет (см. `project/docs/requirements-matrix.md` и
  `project/docs/release-checklist.md`);
- публикация в RuStore и physical-device acceptance остаются за владельцем.

Секреты, пароли, токены и серверные учётные данные в этот документ намеренно
не включены.

## API и модель данных

### API

`apps/api` — **заготовка, а не рабочий API игры**: это каркас NestJS с одним `main.ts`,
Dockerfile и Swagger. Игровой runtime его не использует, E2E блокирует внешние и
`/api`-запросы и считает их ошибкой теста. Синхронизация с облаком и backend
сознательно вне MVP. Поэтому «API» здесь означает контракты домена и модель данных,
а не сетевые endpoints.

### Модель данных

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

Сущности:

- `GameProfile` — корень локального состояния: идентификаторы, питомец, отдельные
  балансы wallet/savings, текущий и завершённые периоды, транзакции, обучение,
  demo-флаг, timestamps и `schemaVersion`.
- `Pet` — имя, вид и комбинируемый внешний вид (`species × colorVariant ×
  accessoryVariant`), обратимое состояние, монотонная стадия и накопительный прогресс.
- `GamePeriod` — один финансовый цикл со статусами `PLANNING → ACTIVE → COMPLETED`.
- `BudgetPlan` — planned mandatory/optional/savings, нераспределённый остаток и
  подтверждение; доход не перемещается в savings автоматически.
- `BudgetActual` — реальные обязательные и необязательные траты, накопления,
  дополнительный заработок и доступный остаток; вычисляется из журнала операций.
- `Transaction` — неизменяемое объяснение денежного движения (тип, сумма, источник,
  категория, период, время, metadata).
- `SavingsGoalDefinition` — контентная цель с ценой; профиль хранит только выбранный
  id и текущий savings balance.
- `LearningTaskDefinition` / `TaskResult` — интерактивное задание и результат периода.
- `LearningProgress` — счётчики попыток, завершений, удачных решений и изученных
  последствий по темам, без школьных оценок.
- `PeriodResult` — сохранённый результат: plan-vs-actual, выполнение нужд, регулярность
  накоплений, задания, score, изменения питомца и коды обратной связи.

Хранение: `GameProfile.schemaVersion = 2`; схема не менялась с расширений Этапа 3.
`GamePeriod` хранит `mandatoryNeeds` (закрытые покупки по нуждам), `eventDecisions`
(выбранные решения событий) и `evolutionSeen`. `PeriodResult.snapshot` фиксирует
wallet, savings, goal, состояние и прогресс питомца на момент закрытия. Имя нового
питомца валидируется `PetNameSchema` (trim, 2–16 символов, без управляющих символов).

## Контент и экономика

### Контент

- Расписание текущей программы: 10 дней; `program-schedule.json` назначает каждому дню
  2 задания (T01–T20) и 6 ситуаций (S01–S60); структура и связи проверяются при загрузке
  (`packages/content/index.ts`).
- 8 игровых механик: выбор, сортировка, корзина, распределение монет, перенос в копилку,
  покупка со сдачей в копилку, поиск лишней строки чека, порядок действий.
- За задание начисляется 10 монет после кнопки «Забрать награду»; за все шесть ситуаций
  дня — отдельная награда. Монеты начисляются только после нажатия, повторные прохождения
  учитываются отдельно и не дублируют выплату.
- Для завершения дня нужны 30 минут, оба задания дня, шесть ситуаций, хотя бы одно
  кормление и отсутствие красных показателей (все выше 20).
- Шесть ключевых интерактивных заданий: «Собери бюджет» (`assemble-budget`),
  «Что сначала?» (`needs-first`), «Накопи на самокат» (`save-for-scooter`),
  «Уложись в бюджет» (`fit-the-budget`), «План изменился» (`plan-changed`),
  «Мечта или сейчас?» (`dream-or-now`). Каждое даёт 10 монет один раз за `taskId`.
- Данные прежнего учебного этапа (6 заданий и 30 ситуаций) сохранены отдельно для
  совместимости и не являются расписанием текущей программы.

**Товары** (10 позиций, `packages/content/purchases.json`):

| ID | Название | Тип | Цена | Эффект |
|---|---|---|---|---|
| breakfast | Завтрак | mandatory | 20 | satiety +20 |
| lunch | Обед | mandatory | 30 | satiety +30 |
| care | Уход | mandatory | 15 | care +15, mood +15 |
| snack | Перекус | mandatory | 10 | satiety +10 |
| ball | Мяч | optional | 35 | mood +20 |
| cap | Кепка | optional | 30 | mood +15 |
| toy | Игрушка | optional | 45 | mood +25 |
| icecream | Мороженое | optional | 20 | mood +10 |
| game | Игра | optional | 60 | mood +30 |
| balloon | Шарик | optional | 15 | mood +10 |

**Цели**: `scooter` — Самокат, 200; `pet_house` — Домик Финни, 300;
`space_trip` — Космическое путешествие, 500.

**События** (`kind: decision`): `event_discount`, `event_required_expense`,
`event_bonus`, `event_impulse`, `event_skip`, `event_goal`. В детерминированную
последовательность текущей программы подключены бонус, скидка и дополнительный уход.

### Экономика

Монеты появляются только через `PERIOD_INCOME`, `TASK_REWARD` и `EVENT_REWARD`.
Обычная покупка никогда не берёт монеты из savings; `SAVINGS_DEPOSIT` и
подтверждённый `SAVINGS_WITHDRAWAL` переносят сумму между wallet и savings. Базовый
доход дня — 100 монет (`packages/content/economy.json`); остаток wallet переносится
целиком (например, 20 + 100 = 120). `BudgetPlan` распределяет **новый доход периода**,
а не весь перенесённый кошелёк.

```text
unallocated = income − plannedMandatory − plannedOptional − plannedSavings

spentMandatory = Σ PURCHASE_MANDATORY + Σ EVENT_EXPENSE(category=MANDATORY)
spentOptional  = Σ PURCHASE_OPTIONAL + Σ EVENT_EXPENSE(category=OPTIONAL)
savedActual    = max(0, Σ SAVINGS_DEPOSIT − Σ SAVINGS_WITHDRAWAL)
earnedExtra    = Σ TASK_REWARD + Σ EVENT_REWARD
```

Score не равен остатку денег:

```text
score = 35% mandatoryCare
      + 25% planDiscipline
      + 20% savingsConsistency
      + 20% learning
```

UI не показывает score, adherence и проценты — только реальные монеты, состояние
питомца и объяснения. Feedback даёт не более трёх сообщений в приоритетном порядке:
нужные покупки → накопления → перерасход желаний → обучение.

Развитие питомца монотонно и зависит от серии периодов и совокупных сигналов:

| Стадия | Минимум дней | Сумма сигналов |
|---|---|---|
| Малыш / BABY | 0 | 0 |
| Исследователь / EXPLORER | 3 | 750 |
| Финни-профи / FINNI_PRO | 5 | 1400 |

Инварианты: wallet и savings неотрицательны и учитываются отдельно; цена покупки или
deposit не превышает wallet; withdrawal не превышает savings и требует preview и
подтверждения; `BudgetActual` строится из транзакций, а не копируется из `BudgetPlan`;
неудачный период замедляет рост, но не стирает накопленный прогресс.

## Требования задачи

Статусы: **DONE** — реализован заявленный объём, **PARTIAL** — только часть
пользовательского требования, **NOT STARTED** — не начато, **N/A** — сознательно вне
MVP. Подробные evidence — `project/docs/requirements-traceability.md`.

| Требование | Статус | Реализация |
|---|---|---|
| Первый запуск, boot и onboarding | DONE | bootDestination, GameService.loadGame, App guard |
| Выбор реального питомца и appearance | DONE | PetAppearance, createInitialProfile, registry petOptions |
| Имя питомца 2–16 символов | DONE | PetNameSchema + unit/E2E |
| Выбор первой цели | DONE | selectSavingsGoal, GameService.selectGoal |
| Восстановление Home при reload | DONE | StorageAdapter, GameService, E2E на 3 ширинах |
| Динамический Home | DONE | GameProfile, calculateGoalProgress, PetStatus |
| Production art inventory и registry | DONE | 49 WebP из 41 PNG, registry.test |
| Три стадии и эмоции в resolver | DONE | PetStage, cat/dragon assets |
| Настройки анимаций, reduced motion, повтор обучения | DONE | preferences local adapter, E2E |
| Звук | DONE | preferences + Web Audio, без сети/аудиофайлов |
| Навигация, Back, safe areas | DONE | route guards, E2E 360/390/412 |
| Игровая валюта, отдельные wallet/savings | DONE | PERIOD_INCOME, Transaction, без двойного дохода |
| Активный период PLANNING → ACTIVE | DONE | startPeriod/confirmBudgetPlan |
| Budget Planner: черновик и immutable confirm | DONE | create/update/confirm, шаг 5, доход 100 |
| Plan != Actual | DONE | calculateBudgetActual из Transaction |
| Итог периода и Plan vs Fact | DONE | closePeriod, snapshot, защита от двойного close |
| Покупки 10 товаров двух категорий | DONE | executePurchase, PetState, history |
| Попытка покупки при нехватке | DONE | INSUFFICIENT_FUNDS, профиль неизменен |
| Накопления: preview и снятие с подтверждением | DONE | deposit/preview/withdraw, SAVINGS_* |
| Цель и реальный прогресс накопления | DONE | calculateGoalProgress/Remaining, 3 цели |
| Шесть интерактивных финансовых заданий | DONE | evaluateTask + completeTask, reward once |
| Последствия решений и восстановление | DONE | рассчитанные симуляции, error mapping |
| Сохранение каждого финансового действия | DONE | atomic commit → StorageAdapter |
| Шесть событий, минимум 3 в игре | DONE | resolveDecisionEvent, одно решение/период |
| Реальные изменения PetState и реакция | DONE | эффекты покупок, clamp 0–100 |
| Развитие питомца, 3 стадии | DONE | четыре сигнала, пороги 3/750 и 5/1400 |
| История и LearningProgress | DONE | immutable snapshots, topic counters |
| Взрослый раздел | DONE | reset/delete lifecycle, `/adult`, long press |
| Demo Mode UI | DONE | отдельные namespace, детерминированный reset/exit |
| Полный конкурсный gameplay | DONE | пятидневный локальный цикл, `appendix-a.spec.ts` |
| Offline runtime без backend | DONE | localStorage, E2E блокирует внешние/API запросы |
| Android Capacitor offline wrapper | DONE | bundled production assets, portrait |
| Android Back и system UI integration | PARTIAL | build PASS; нужен device QA |
| Устанавливаемый debug APK | PARTIAL | debug-signed собран; нужен install QA |
| Release APK/AAB | PARTIAL | unsigned artifacts и signing pipeline; нужен ключ владельца |
| PWA offline shell | N/A | выбран Android wrapper |
| API / cloud sync | N/A | optional future, не MVP |
| **Текущая программа 10 дней / 20 заданий / 60 ситуаций** | DONE | `program-content.spec.ts`, `daily-life.spec.ts`, `finale-daily.spec.ts` |
| Награды повторов заданий и наборов после 10 дней | DONE | 150 модульных/интеграционных тестов; защита от дублей |
| Physical device / emulator acceptance | NOT STARTED | устройство и AVD отсутствовали |

## Демо-сценарий

Цель — показать обязательный путь за 2–4 минуты. Все решения нажимает демонстратор;
Demo Mode только убирает ожидание и подсказывает следующий шаг.

| Время | Действие | Что проговорить |
|---|---|---|
| 0:00 | На стартовом экране нажать «Демо-режим» | Никакой регистрации и настоящих данных ребёнка |
| 0:15 | Выбрать самокат | Цель конкретна, копилка отделена от кошелька |
| 0:30 | «Начать день» → план 40/30/30 | Ребёнок распределяет ограниченный доход |
| 0:55 | Выполнить «Собери бюджет» | Ошибку можно исправить; награда выдаётся один раз |
| 1:15 | Купить обед и мяч | Нужная и желаемая покупка, влияние на Финни |
| 1:35 | Попробовать купить игру | Недостаток средств объясняется ценой и остатком |
| 1:50 | Отложить 30 монет | План «Коплю» не переводит деньги сам |
| 2:10 | Завершить день | Рядом стоят план, факт, feedback, баланс и PetState |
| 2:35 | Показать следующий день/развитие | Периоды доступны сразу; развитие зависит от серии решений |
| 2:50 | Settings → «Для взрослых», удерживать 3 секунды | Темы, цель, история, privacy/offline, reset/delete |
| 3:20 | Settings → «Выйти из демо» | Обычная игра возвращается без изменений |

Для показа обеих эволюций используется пятидневный маршрут: дни 1–3 приводят к
«Исследователю», дни 4–5 — к «Финни-профи».

Резервные пути:

- **уже существует обычный профиль** — Settings → «Демо-режим» → подтвердить:
  обычный профиль останется в отдельном хранилище;
- **демо уже пройдено** — Settings → «Начать демо заново» (одинаковый профиль без
  денег, цели и истории);
- **открыт не Home** — кнопка «Дом» или «Назад»; из взрослого раздела — «Вернуться
  к Финни»;
- **цель достигнута** — выбрать следующую мечту либо «Начать демо заново»;
- **нужна обычная игра** — Settings → «Выйти из демо» → подтвердить.

## Известные ограничения

- `apps/api` — заготовка: в игровом runtime endpoints не используются.
- Android: physical-device acceptance не выполнен, release-артефакты не подписаны —
  нужен постоянный production keystore владельца.
- Браузерная QA подтверждает игровую логику, но не заменяет проверку установленного APK.
- Проект публикуется как статическая веб-сборка; серверный backend и облачная
  синхронизация вне MVP.
