# RuStore — технический паспорт сборки

## Идентификация

| Поле | Значение |
|---|---|
| Название | Финни |
| Application ID | `ru.onesolution.finni` |
| Version name | `1.0.0` |
| Version code | `1` |
| Форм-фактор | Android phone, portrait |
| Minimum Android | Android 8.0 / API 26 |
| Target / compile SDK | API 36 / API 36 |
| Движок | Capacitor 8 + локальный SolidJS bundle |

## Данные и сеть

- Игровое ядро работает offline; аккаунт, backend и cloud sync не требуются.
- Имя питомца, состояние игры, транзакции, прогресс, Demo и настройки хранятся локально в WebView `localStorage`.
- Приложение не заявляет сбор персональных данных, платежи, рекламу или аналитику.
- Нет обязательных runtime URL/API; INTERNET permission удалён.
- Reset создаёт новое локальное игровое состояние, Delete удаляет профиль; uninstall удаляет данные приложения средствами Android.
- Целевая аудитория продукта: дети 7–11 лет; окончательные возрастная маркировка и тексты карточки должны быть подтверждены владельцем при публикации.

## Permission audit

В итоговом merged manifest нет INTERNET, storage, location, camera, contacts или microphone permissions. Единственная permission — автоматически созданная AndroidX signature-level:

```text
ru.onesolution.finni.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION
```

Она защищает внутренние dynamic receivers приложения и не запрашивает согласие пользователя.

## Артефакты Этапа 5

| Артефакт | Размер | SHA-256 | Статус |
|---|---:|---|---|
| `Finni-1.0.0-debug.apk` | 13,876,784 B (13.23 MiB) | `34fa7d4588a9b2a3e4c02c37376cb5f39af08e8ba8850f3e20426dd6d0d05f4b` | Debug-signed, QA only |
| `Finni-1.0.0-release-unsigned.apk` | 10,653,210 B (10.16 MiB) | `311adc549028dd07e1566ed8c89eb1b4be475108b39a5e4d5bde530e57222e72` | Unsigned |
| `Finni-1.0.0-release-unsigned.aab` | 10,518,588 B (10.03 MiB) | `8627b5afca5009c7cd648d412d32d83779f59ef47c754d32d5a6f231d31765d9` | Unsigned |

Контрольная копия хешей: `artifacts/android/SHA256SUMS.txt`.

## До загрузки в RuStore

Эти release artifacts не готовы к отправке, пока владелец не предоставит постоянный production keystore. После подписи нужно повторить package/signature/zipalign audit и physical-device acceptance, затем подготовить карточку, политику, screenshots и иные обязательные материалы кабинета по актуальным требованиям RuStore.
