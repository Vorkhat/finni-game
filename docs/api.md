# API и контракты

Назначение: зафиксировать, что «API» в этом проекте — контракты домена, а не сетевые endpoints.

## Содержание

- [Сетевой API](#сетевой-api)
- [Контракты домена](#контракты-домена)
- [Модель данных](#модель-данных)

## Сетевой API

`apps/api` — заготовка, а не рабочий API игры: каркас NestJS с одним `main.ts`, Dockerfile и Swagger. Игровой runtime его не использует, E2E блокирует внешние и `/api`-запросы и считает их ошибкой теста. Синхронизация с облаком и backend сознательно вне MVP. `docker-compose.yml` поднимает локальный стаб на `127.0.0.1:3000` только для разработки.

## Контракты домена

Доменные операции `packages/shared` чистые: получают состояние и команду, возвращают новое состояние либо `DomainError`. Входы валидируются Zod-схемами, состояние не мутируется напрямую. Оркестрацию и локальный adapter хранит `apps/web/src/application`.

- период: `startPeriod`, `confirmBudgetPlan`, `closePeriod`;
- деньги: `executePurchase`, `depositSavings` / preview / `withdrawSavings`;
- обучение: `evaluateTask`, `completeTask`, `resolveDecisionEvent`;
- цель: `selectSavingsGoal`, `calculateGoalProgress`, `calculateBudgetActual`;
- хранение: `StorageAdapter` (`loadProfile`, `saveProfile`, `deleteProfile`, `resetProfile`, `hasProfile`).

Путь команды: UI → `GameService` (application layer) → доменная операция shared → новый снимок → `StorageAdapter`. `GameService.commit` сначала сохраняет профиль, затем публикует состояние; повторный `transactionId` и повторная награда отвергаются, все `DomainError` централизованно преобразуются в сообщения в `error-messages.ts`.

## Модель данных

Структура `GameProfile`, периоды, транзакции и версии схемы — в [data-model.md](data-model.md).
