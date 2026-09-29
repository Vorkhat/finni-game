# Этап 3 — Period Result, пять периодов и развитие Финни

Этап завершён 15 сентября 2026. Архитектура сохранена: UI → GameService → Shared Domain → StorageAdapter → localStorage. Этап 4 не начат.

## Period Result

CTA «Завершить день» открывает confirmation с «Посмотреть итоги» и «Ещё не закончил». ACTIVE и подтверждённый BudgetPlan — достаточные условия; покупки, задания и накопления не обязательны. После подтверждения `/day/result` показывает три карточки Нужно/Хочу/Коплю: план, фактические монеты и подписанные полосы. Не используются проценты или score ребёнка.

`closePeriod` пересчитывает Actual по транзакциям, PlanVsActual, care/savings/learning, score, PetState, накопительный PetProgress и stage. COMPLETED-период со snapshot добавляется в periodHistory, currentPeriod становится null. GameService сначала сохраняет целый профиль, затем публикует его. Повторный close и повторный income запрещены. Неудачная запись не публикует результат и допускает безопасный retry.

В браузере проверен пример plan 40/30/30 → actual 30/40/20; конечный wallet 10 и savings 20. Экран также показывает фактическое состояние Финни, расстояние до выбранной тогда цели и долгосрочное развитие.

## Feedback

`feedbackCodes` сопоставляются с текстами `packages/content/feedback.json`. Максимум три сообщения: сначала обязательные нужды, затем полное/частичное/нулевое накопление, затем перерасход желаний; если его нет — выполненное задание, иначе желания в плане. Тексты объясняют связь решений с монетами, сытостью и развитием, без оценки личности ребёнка. При любом результате остаётся следующий день и предложение попробовать ещё.

## Five periods

Пять дней доступны подряд без календарного ожидания. Каждый получает новый income, новый plan/actual, свои taskResults и eventDecisions. Рекомендации: Собери бюджет → Что сначала? → Накопи на самокат → Уложись в бюджет → План изменился. После пяти предлагается Мечта или сейчас? Все шесть по-прежнему доступны в Tasks; пройденная заранее рекомендация заменяется доступной историей.

Интеграционный и полный браузерный сценарии совершают реальные действия, без присваивания progress: обед, небольшой необязательный расход, 40 в копилку и задание. В день 4 вместо необязательной покупки учитывают дополнительный уход. Получаются BABY, BABY, EXPLORER, EXPLORER, FINNI_PRO, 200 в копилке и 125 в кошельке.

## Economy between periods

- Wallet сохраняется; 100 монет нового дня добавляются сверху.
- Savings и выбранная цель сохраняются, никаких автоматических списаний.
- На каждый день ровно один PERIOD_INCOME; Back/reload не создают income.
- Сохранён контракт foundation: план распределяет новый доход, перенесённый wallet доступен как резерв. На старте показан остаток отдельно. Факт может превысить план.
- Task rewards и bonus не меняют подтверждённый план.

Подробные формулы и пример 20 + 100 = 120 — в [экономике](economy.md).

## PetProgress

Используется прежняя модель: mandatoryCare, planDiscipline, savings, learning и completedPeriods. Каждый день добавляет 0–100 по четырём сигналам. Нужды новых дней — завтрак или обед, в день 4 ещё уход; проверяются реальные покупки по purchaseId. Частичное покрытие даёт пропорциональную заботу. Для legacy-периодов без списка нужд работает денежный fallback.

Пустой план не даёт planDiscipline; нулевое реальное накопление не даёт savings даже при нулевом плане. Learning зависит от успешных taskResults. Внутренний score: care 35%, discipline 25%, savings 20%, learning 20%. Ребёнку он не показывается.

## Evolution

BABY → EXPLORER: минимум 3 закрытых дня и сумма четырёх накопленных signals ≥750. FINNI_PRO: минимум 5 дней и сумма ≥1400. Это явное изменение balance foundation 2/500 и 4/1100; существующие достигнутые стадии миграция не пересчитывает. Стадия не понижается после слабого дня.

После qualifying result следующий переход ведёт в `/day/evolution`: старая стадия, glow, мягкое появление новой, CSS scale/opacity и искры. Новая стадия названа текстом. Настройка анимаций и prefers-reduced-motion учитываются; интенсивные эффекты отключаются. Heavy animation dependencies не добавлялись.

Home использует stage из профиля. Registry выбирает production asset по species/color/stage/emotion; fallback на idle, затем предыдущую доступную стадию того же вида и цвета. Для отсутствующей стадии есть dev warning, для неизвестной внешности — безопасный текст вместо broken image.

`evolutionSeen` сохраняется отдельно по нажатию «Продолжить вместе». Reload до подтверждения возобновляет ещё не подтверждённое celebration; после подтверждения оно не повторяется. Прогресс начисляется только при close, никогда при показе celebration.

## Events

| День | Событие | Настоящее последствие |
| --- | --- | --- |
| 2 | Приятный бонус | Принять +10, EVENT_REWARD |
| 3 | Мяч со скидкой | Купить за 28 вместо 35, EVENT_EXPENSE/OPTIONAL, либо пропустить |
| 4 | Немного заботы | Уход за 25, EVENT_EXPENSE/MANDATORY и PetState, либо отложить |

Пропуск сохраняет решение без транзакции. Повторное решение и событие чужого дня отвергаются. Нехватка денег не изменяет профиль; карточку можно закрыть, пропустить покупку или вернуться с деньгами. Цена ухода в событии специальная, обычный уход в магазине остаётся 15. Обе покупки могут покрыть потребность дня. Событийные покупки видны и в истории магазина.

## Goal achievement

При savings ≥ goal.cost показана «Мечта сбылась!». Есть «Выбрать новую мечту» и возможность продолжать с прежней целью. Подтверждение сохраняет achievedGoalIds; выбор показывает оставшиеся цели. Деньги не списываются. В браузере доказан переход Самокат → Домик Финни с сохранением 200 монет и восстановлением после reload.

## Progress & History

`/progress`: фактическая стадия и её изображение, число завершённых дней и заданий, цель, накопления, три темы LearningProgress, последний результат и карточки дней. Статусы тем происходят из существующего completedTasks, отдельного учебного score нет. История открывает `/day/result/:id` с сохранёнными planVsActual и snapshot; будущие операции или смена цели не меняют старый результат.

## Persistence

Reload проверен после каждого из пяти результатов, между днями 2/3, после обеих эволюций, после пятого дня, после события и смены цели. Сравниваются целые профили: history, progress, stage, wallet, savings, goal, transactions. Дубликатов результата, progress, income, task reward и event consequence нет. Есть тест отказа save при закрытии и безопасного retry.

## Migration

Schema version 1 → 2; versionless профили тоже поддерживаются. Новые поля: mandatoryNeeds, eventDecisions, evolutionSeen, result.snapshot, achievedGoalIds. Старые деньги, история, цель и питомец сохраняются. Старые результаты получают snapshot=null, UI не придумывает исторические значения и поясняет ограничение. Старые evolutions помечаются просмотренными. Миграция не требует очистки localStorage; v2 сохраняется при следующей успешной команде.

## Tests

71 unit/integration test в 10 файлах: исходные 47 сохранены, добавлены 14 проверок Plan/Fact и signals, 9 integration-проверок серии/событий/persistence/миграции и 1 проверка fallback стадии. Foundation-тест полного цикла обновлён с четырёх до пяти дней в соответствии с новым балансом, ожидание schemaVersion обновлено до 2.

## E2E

48 проверок = 16 сценариев × 3 viewport (360×640, 390×844, 412×915). Исходные 33 сохранены; переходный текст Этапа 2 заменён проверкой confirmation. Новые 15: итог и повторные действия; qualifying evolution/reduced-motion; полный пятидневный UI-path с пятью реальными заданиями и событиями; слабый день/recovery; достигнутая цель и выбор следующей.

Production preview запускает только web. Runtime/console errors и внешние/API запросы считаются ошибкой E2E; все проверяемые изображения должны загрузиться. В sandbox первоначально обнаружен spawn EPERM запуска Chromium; проверки выполняются с разрешённым запуском локального браузера вне sandbox.

## Quality gate

| Команда | Результат |
| --- | --- |
| pnpm lint | PASS |
| pnpm test | PASS — 71 |
| pnpm build | PASS |
| pnpm e2e | PASS — 48, финальный прогон 3,1 минуты |

QA обнаружил выход навигации первого Home за viewport на 360×640. Исправлен контейнер прокрутки для всех Home-состояний, без уменьшения touch targets. Также убран лишний повтор персонажа из goal celebration. Требования тестов не ослаблялись. Финальный полный прогон: все 48 PASS, runtime/console errors и внешние/API requests отсутствуют. Проверена production-сборка на локальном preview без backend.

## Screenshots

24 снимка в `docs/qa/stage3`: восемь видов на всех трёх размерах. Обязательные:

- [period-result-360.png](qa/stage3/period-result-360.png)
- [period-result-390.png](qa/stage3/period-result-390.png)
- [period-result-412.png](qa/stage3/period-result-412.png)
- [evolution-explorer-390.png](qa/stage3/evolution-explorer-390.png)
- [evolution-pro-390.png](qa/stage3/evolution-pro-390.png)
- [progress-390.png](qa/stage3/progress-390.png)
- [history-390.png](qa/stage3/history-390.png)
- [event-390.png](qa/stage3/event-390.png)
- [goal-achieved-390.png](qa/stage3/goal-achieved-390.png)

Дополнительно period-result-state на всех размерах показывает нижнюю часть результатов. Длинные экраны прокручиваются внутри viewport; скриншоты показывают реальные мобильные состояния, не искусственно растянутую страницу.

## Requirements

В [матрице](requirements-matrix.md) DONE: финальный Plan vs Fact и последствия; пять последовательных периодов; накопительное монотонное развитие и три стадии; history/progress; persistence между периодами; минимум три события; goal achievement. Полный конкурсный gameplay остаётся PARTIAL, пока нет взрослого раздела. Adult Section, Demo Mode UI, Android и PWA shell не отмечены DONE.

## Changed files

- `packages/shared/src/{schemas,economy}.ts`: schema v2, migration, сигналы/пороги, snapshots, event decisions, acknowledgement, duplicate guards.
- `packages/content/{periods,feedback,events}.json`, `index.ts`: последовательность, нужды, детские тексты.
- `apps/web/src/application/game-service.ts`: новые атомарные команды.
- `apps/web/src/screens/{PeriodResult,Evolution,Progress}.tsx`: новые рабочие экраны.
- `apps/web/src/components/PeriodExtras.tsx`: события и достижения целей.
- `Home`, `Budget`, `Savings`, `GoalSelect`, `Shop`, `App`, `index.tsx`: подключение цикла и переходов.
- `assets/registry.ts`, `periods.css`, `gameplay.css`: fallback, celebration и мобильная прокрутка.
- Новые domain/application/E2E-тесты и обновлённые ожидания foundation.
- README, architecture/data-model/economy/content-map/requirements-matrix, этот отчёт и QA.

## Remaining risks

- Chromium с мобильными viewport проверен; физический Android, системный Back и реальные safe-area относятся к device QA.
- Межвкладочной синхронизации и облачного backup нет; очистка браузерных данных удаляет профиль.
- Устанавливаемый offline shell/service worker не реализован. Локальная раздача web-файлов нужна; игровой runtime не делает внешних/API запросов.
- Legacy-история не содержит состояния/копилки, которых раньше не сохраняли; такие snapshots не восстанавливаются искусственно.
- Шесть заданий дают награду один раз; после их прохождения дни продолжаются, но новых заданий контент пока не добавляет.
- Остаются build warning Vite 5 CJS Node API и служебные NO_COLOR/FORCE_COLOR warnings тестового runner; runtime ошибок они не означают.

## Next step

**Этап 4 — Demo Mode + Adult Section + полный обязательный Appendix A E2E + финальная UX-полировка перед Android.** Только по отдельной команде.
