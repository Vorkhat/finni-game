# Этап 2 — Core Gameplay

Этап завершён 15 сентября 2026 года. Этап 3 не начат. Production preview: `http://127.0.0.1:4173`.

## Gameplay implemented

Работает активная часть одного дня: Home → объяснение дохода → +100 → распределение плана → подтверждение → магазин → обязательная и необязательная покупки → объяснение нехватки → интерактивное задание → награда → перевод в копилку → Home с реальным состоянием и сводкой → reload.

Архитектура сохранена: UI → GameService → Shared Domain → StorageAdapter → localStorage. Backend не запускался для игрового сценария. Цены, эффекты, награды и цели берутся из существующего content; доход и шаг управления вынесены в валидируемый `economy.json`. Новые питомцы, товары, цели и задания не добавлялись.

`/day/result` показывает переход к будущим итогам, но не вызывает closePeriod и не начинает следующий день.

## Budget

- Начало дня создаёт один PERIOD_INCOME: amount=100, source=period_income, periodId.
- Budget Planner: «Нужно / Хочу / Коплю», иконки, точные суммы, кнопки ±5, доступно/распределено/остаток. Нераспределённый остаток разрешён.
- Изменения черновика сохраняются через setPlan. Превышение суммы показывает детское объяснение, а не технический код.
- Summary перед confirm; после confirm план immutable, период ACTIVE.
- plannedSavings не увеличивает savingsBalance или savedActual. Факт вычисляется из транзакций, не из локальных счётчиков UI.
- Home и Budget показывают компактный текущий план/факт; это не финальный Period Result.

## Shop

Подключены все 10 исходных товаров. Карточки содержат production asset, название, цену, текстовую категорию и ожидаемые эффекты. Покупка требует подтверждения; отказ закрывает диалог без изменений.

Успешная покупка меняет кошелёк и PetState, создаёт PURCHASE_MANDATORY/PURCHASE_OPTIONAL с periodId, обновляет BudgetActual и сохраняется. История покупок выводится из транзакций текущего периода.

Дорогие товары не disabled. В обязательном сценарии игра за 60 при кошельке 35 вызывает INSUFFICIENT_FUNDS. UI показывает цену 60, остаток 35, нехватку 25, переход к заданиям и возможность отложить покупку. Профиль полностью неизменен.

## Savings

Показаны текущая цель, её изображение, накоплено/стоимость, оставшаяся сумма и progress; кошелёк и копилка видны одновременно как разные деньги.

Deposit: быстрые прибавления +10/+20/+30 и точная корректировка по одной монете, ограничение текущим wallet, предварительный просмотр и подтверждение. Создаётся SAVINGS_DEPOSIT.

Withdrawal: менее заметная кнопка, сумма, вызов previewSavingsWithdrawal через сервис, демонстрация будущего остатка и расстояния до цели. Отмена ничего не меняет. Только подтверждение вызывает withdrawFromSavings и создаёт SAVINGS_WITHDRAWAL.

## Tasks

Все шесть типов реально интерактивны и проверены в браузере:

| Тип | Управление | Проверенный результат |
| --- | --- | --- |
| allocate_budget | распределение кнопками ±5, не radio | 40/30/30 из 100 → награда |
| prioritize | выбор первой покупки, изменение порядка | игрушка оставляет 10; исправление на обед → успех |
| savings_choice | суммы 10/30/50 и визуальное изменение учебной цели | 50 → в учебной копилке 130, до цели 70 |
| shopping_cart | самостоятельное добавление/удаление товаров | корзина 90 → нехватка 20; убрать игрушку → корзина 45 |
| unexpected_expense | выбор ухода, мяча или паузы, повтор | мяч оставляет 15; пересмотр на уход оставляет 25 |
| goal_vs_want | игра, перевод 50 или части 30 | сравнение кошелька/цели и успешный перевод части |

TaskRenderer выбирает управление по task.type и использует definitions, а не hardcoded отдельные страницы. `evaluateTask` в shared проверяет структуру ответа, actions, товары, суммы и все successConditions. `completeTask` повторно вычисляет успех перед выдачей награды.

Симуляции не меняют настоящий wallet/savings, PetState или реальные покупки. Только успешное завершение создаёт TASK_REWARD, source=task:<taskId>, обновляет CompletedTask/TaskResult/LearningProgress. По исходному контенту награда каждого задания — 10 монет. Повторная выдача запрещена.

Для произвольной корзины feedback использует вычисленные суммы, а не пример одной комбинации. Неудачные решения получают последствия, объяснение и возможность пересмотра без оценки личности ребёнка.

## Pet reactions

Обед действительно меняет сытость, мяч — настроение. В сквозном тесте PetState становится satiety=100, mood=90, care=70. Значения ограничены существующим доменом диапазоном 0–100 и отображаются на Home.

В положительной обратной связи используется реальный happy-образ кота. У дракона нет happy-файла — registry безопасно возвращает idle того же дракона. Эмоция не сохраняется в финансовый профиль и исчезает при уходе со страницы/закрытии feedback. Исходные WebP не заменены; у отображения монеты CSS-маской скрыт край соседней плашки исходного атласа.

## Persistence

Через GameService проверена цепочка load → startPeriod → setPlan → confirmPlan → purchase → deposit → preview/withdraw → completeTask → reload. После каждого успешного изменения сохранённый профиль равен опубликованному.

E2E выполняет reload после черновика/confirm, покупки, task reward, deposit и withdrawal. Не повторяются доход, покупки или награда. Ожидаемая арифметика главного сценария: 100 − 30 − 35 + 10 − 20 = 25 в кошельке, 20 в копилке. Plan/Actual: Нужно 40/30, Хочу 30/35, Коплю 30/20; цель 20/200. В журнале ровно пять денежных записей.

GameService блокирует пересекающиеся сохранения до вычисления нового состояния; неудачный save не публикует финансовое действие и допускает безопасный retry. Домен отклоняет повторный transactionId и повторный taskId. UI использует busy/disabled, а экран награды кратко блокирует новые ссылки от попадания второго клика после замены экрана.

## E2E

33 успешные проверки = 11 сценариев × 3 размера: 360×640, 390×844, 412×915. На каждом размере:

- полный день от нулевого кошелька до сохранённых покупок, награды и накоплений;
- preview/отмена/подтверждение снятия, double click и Back;
- отдельный interaction/feedback/completion/reward-тест для каждого из шести renderer;
- три сохранённых сценария Этапа 1: первый запуск, дракон/имена/настройки, реальные сохранённые значения Home.

Production preview используется без backend. В Stage 2 тестах перехватываются внешние/API-запросы и runtime/console errors; итоговые списки пусты. У всех проверяемых изображений naturalWidth > 0. Проверяются ширина страницы, нахождение модалей внутри viewport, размеры task controls ≥48×48 и отсутствие перекрытия сводки Home навигацией после прокрутки.

## Tests

| Команда | Итог |
| --- | --- |
| pnpm lint | PASS, включая типы E2E |
| pnpm test | PASS — 47 тестов в 8 файлах |
| pnpm build | PASS — production web build |
| pnpm e2e | PASS — 33 проверки, последний полный прогон 57,9 с |

Исходные 31 unit/integration и 9 E2E сохранены. Добавлены 12 domain/content и 4 application-теста, 24 браузерные проверки. В сборке остаётся предупреждение Vite 5 об устаревающем CJS Node API; оно не является runtime-ошибкой.

## Screenshots

Сохранён 51 новый QA-снимок в `docs/qa/stage2`. Проверены глазами обязательные экраны и все виды заданий, отдельно узкий Home/диалог и Home 412 px.

| Экран | Снимок |
| --- | --- |
| Budget 360 | [budget-360.png](qa/stage2/budget-360.png) |
| Budget 390 | [budget-390.png](qa/stage2/budget-390.png) |
| Shop | [shop-390.png](qa/stage2/shop-390.png) |
| Успешная покупка | [purchase-success-390.png](qa/stage2/purchase-success-390.png) |
| Нехватка монет | [insufficient-funds-390.png](qa/stage2/insufficient-funds-390.png) |
| Savings | [savings-390.png](qa/stage2/savings-390.png) |
| Успешный deposit | [deposit-success-390.png](qa/stage2/deposit-success-390.png) |
| Tasks | [tasks-390.png](qa/stage2/tasks-390.png) |
| Активное задание | [task-active-390.png](qa/stage2/task-active-390.png) |
| Результат задания | [task-result-390.png](qa/stage2/task-result-390.png) |
| Активный Home | [home-active-390.png](qa/stage2/home-active-390.png) |
| Узкий Home и сводка | [home-active-360.png](qa/stage2/home-active-360.png), [home-active-summary-360.png](qa/stage2/home-active-summary-360.png) |
| Home 412 | [home-active-412.png](qa/stage2/home-active-412.png) |

Дополнительно для каждого размера есть `task-allocate_budget`, `task-prioritize`, `task-savings_choice`, `task-shopping_cart`, `task-unexpected_expense`, `task-goal_vs_want`. Длинные экраны используют вертикальную прокрутку, а не уменьшение touch targets и текста.

QA обнаружил и помог исправить: попадание второго клика в ссылку после награды, наложение footer на длинные игровые страницы и перекрытие активной сводки Home на 360 px. Нет удаления/ослабления существующих тестов ради зелёного результата.

## Requirements

В [матрице](requirements-matrix.md) DONE: currency, активный период, budget planning, различие plan/actual, покупки, недостаток средств, savings с preview/withdrawal, финансовая цель, шесть заданий, consequence feedback, изменения PetState и persistence.

Полный gameplay остаётся PARTIAL. Итог периода, серия периодов и развитие по серии не объявлены DONE. Adult и Demo UI не начаты. Event definitions сохраняют FOUNDATION.

## Changed files

- `packages/shared/src/{schemas,economy}.ts` — TaskSubmission/evaluation, preview/derived расчёты, контроль дубликатов и ошибки.
- `packages/content/{economy,tasks}.json`, `index.ts`, `gameplay-domain.test.ts` — настройки, адаптивный feedback и проверки.
- `apps/web/src/application/{game-service,game-context,error-messages}.ts*`, `gameplay.integration.test.ts` — atomic orchestration, error mapping, save/reload.
- `apps/web/src/screens/{Budget,Shop,Savings,Tasks,Home}.tsx` — игровой день и Home.
- `apps/web/src/components/{gameplay,TaskRenderer}.tsx`, `gameplay.css`, `index.tsx` — reusable controls, renderer, мобильная прокрутка и маршруты.
- `e2e/core-gameplay.spec.ts` — сквозной день и все task types.
- `README.md`, `docs/{architecture,data-model,economy,content-map,requirements-matrix,stage2-report}.md`, `docs/qa/stage2/**` — документация и QA.

## Remaining risks

- Проверено в Chromium с мобильными viewport, не на физическом Android. Реальные safe-area, системный Back и экранная клавиатура требуют device QA при упаковке.
- localStorage не синхронизируется между одновременно открытыми вкладками; рекомендуется одна игровая вкладка. Очистка данных браузера удаляет локальное сохранение.
- Незавершённая учебная симуляция временная: reload сбрасывает её черновик, но не выданную награду и не настоящий профиль. Промежуточные исследовательские клики не сохраняются как отдельные попытки LearningProgress.
- PWA service worker, аудио, Android wrapper, Event UI, финальный период, эволюция, взрослый раздел и Demo UI намеренно не реализованы на Этапе 2.

## Next step

Только по отдельной команде: Этап 3 — Period Result → Plan vs Fact → 5 игровых периодов → cumulative PetProgress → 3 стадии развития → evolution celebration.
