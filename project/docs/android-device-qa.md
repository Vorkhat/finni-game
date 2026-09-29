# Android device QA

Статус среды Этапа 5: emulator binary/AVD отсутствуют, `adb devices -l` не показал устройств.

**PHYSICAL DEVICE QA REQUIRED**

Автоматизированный browser evidence не заменяет WebView/device acceptance. Выполнить на Android 8/API 26 и на современном Android 15/16.

## Install

- [ ] Включить USB debugging и убедиться, что `adb devices -l` показывает `device`.
- [ ] `adb install -r artifacts/android/Finni-1.0.0-debug.apk` завершается успешно.
- [ ] Launcher показывает имя «Финни» и правильную adaptive icon при круглой/квадратной маске.

## Launch и system UI

- [ ] Splash без белого/чёрного flash и без искусственной задержки.
- [ ] Только portrait; поворот устройства не ломает экран.
- [ ] Status/navigation bars читаемы; content не перекрыт вырезом, gesture bar и клавиатурой.
- [ ] На 360dp доступны все CTA; длинные экраны и modals прокручиваются.

## Offline

- [ ] Первый запуск после установки проходит в airplane mode.
- [ ] Appendix A, покупки, задания, накопления, результаты, эволюция, Adult и Demo работают без сети.
- [ ] В `adb logcat` нет обязательных network/API ошибок.

## Gameplay и persistence

- [ ] Создать профиль, выбрать цель, начать день, подтвердить бюджет, купить товар, выполнить задание и сделать deposit.
- [ ] Увести приложение в background на 1–5 минут и вернуться: состояние сохранено, операция не повторилась.
- [ ] Force stop / swipe away / перезапуск: wallet, savings, goal, active period, transactions и history восстановлены.
- [ ] Установить новую сборку с большим versionCode через `adb install -r`: localStorage сохранён.
- [ ] Uninstall действительно удаляет локальные данные; это отличается от in-app Reset/Delete.

## Android Back

- [ ] При открытом dialog Back закрывает только dialog.
- [ ] На вложенном экране Back возвращает на предыдущий экран без повторного financial action.
- [ ] На Home Back завершает Activity; повторный запуск восстанавливает сохранение.
- [ ] Back во время busy/save не дублирует purchase/reward/deposit/period close.

## Keyboard, touch, long press

- [ ] Клавиатура не перекрывает имя питомца/сумму; `adjustResize` работает.
- [ ] Валидация имени и числового ввода остаётся доступной.
- [ ] Tap targets удобны, случайный long-press/context menu не мешает.
- [ ] Adult Gate требует непрерывного удержания 3 секунды; отпускание/уход пальца сбрасывает progress.

## Demo, Adult, Appendix A

- [ ] Полный Appendix A 1–12 на установленном APK — PASS.
- [ ] Demo reset детерминирован; выход восстанавливает точный normal profile.
- [ ] Adult reset и delete различаются; Delete после reload остаётся на onboarding.
- [ ] Сделать screenshots: launch, home, budget, shop, result, evolution, adult, demo в `docs/qa/android/`, указав устройство/API.
