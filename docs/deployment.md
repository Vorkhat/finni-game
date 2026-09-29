# Развёртывание

Назначение: веб-развёртывание, сборка Android, подпись release и публикация в RuStore.

## Содержание

- [Веб](#веб)
- [Зафиксированный Android-стек](#зафиксированный-android-стек)
- [Подготовка](#подготовка)
- [Assets и sync](#assets-и-sync)
- [Debug APK](#debug-apk)
- [Release APK и AAB](#release-apk-и-aab)
- [Подпись release](#подпись-release)
- [RuStore — технический паспорт](#rustore--технический-паспорт)
- [Чек-лист релиза](#чек-лист-релиза)
- [Важные свойства](#важные-свойства)

## Веб

**Веб-версия** разворачивается как статический сайт:

1. `pnpm build` формирует `apps/web/dist`.
2. Содержимое `dist` копируется в корень сайта.
3. Настраивается SPA fallback: маршруты вида `/home`, `/tasks` должны возвращать `index.html`,
   а существующие `/assets/` — отдаваться как файлы.
4. Размещение в подпапке требует отдельной настройки базового пути.
5. Backend и база данных для игры не нужны.

Локальная проверка production-сборки — `pnpm preview` (Vite preview, порт 4173).
`docker-compose.yml` поднимает локальный API-стаб на `127.0.0.1:3000` для разработки и не
участвует в игровом пути.

## Зафиксированный Android-стек

- Capacitor CLI/Core/Android: 8.5.2.
- Официальные plugins: App 8.1.1, Splash Screen 8.0.2, Status Bar 8.0.3.
- Node: 24.16.0; минимальное требование Capacitor 8 — Node 22+.
- JDK: Microsoft OpenJDK 21.0.12.1.
- Gradle wrapper: 8.14.3; Android Gradle Plugin: 8.13.0.
- compileSdk/targetSdk: 36; minSdk: 26 (Android 8.0+).
- Application ID: `ru.onesolution.finni`; versionName/versionCode: `1.0.0` / `1`.

## Подготовка

```bash
pnpm install
pnpm build
```

На Windows можно развернуть проверенный portable toolchain в `.tooling/`:

```powershell
pnpm android:toolchain
```

Скрипт проверяет SHA-256 архивов, устанавливает JDK 21, Android platform-tools, Platform 36 и Build Tools 36.0.0. AGP при сборке также выбирает совместимые Build Tools 35.0.0. `.tooling/` и `android/local.properties` не коммитятся. Если Android Studio уже установлен, используйте его JDK/SDK и пропустите bootstrap.

## Assets и sync

```bash
pnpm android:assets
pnpm android:sync
```

`android:assets` воспроизводимо создаёт launcher/adaptive/splash resources из `resources/android`. `android:sync` выполняет production Vite build, затем `cap sync android`. Web assets копируются из `apps/web/dist`; `server.url` отсутствует.

## Debug APK

```bash
pnpm android:build
```

Проверенный output:

- `android/app/build/outputs/apk/debug/app-debug.apk`;
- экспорт: `artifacts/android/Finni-1.0.0-debug.apk`.

Debug APK подписан стандартным Android Debug certificate и предназначен только для QA.

## Release APK и AAB

```bash
pnpm android:release
```

Без release signing environment команда создаёт:

- `artifacts/android/Finni-1.0.0-release-unsigned.apk`;
- `artifacts/android/Finni-1.0.0-release-unsigned.aab`;
- `artifacts/android/SHA256SUMS.txt`.

С постоянным ключом владельца та же Gradle-конфигурация подписывает release (см. ниже).

## Подпись release

`android/app/build.gradle` читает только переменные окружения. Если задана хотя бы одна, но не все, сборка останавливается; если keystore не существует, сборка тоже останавливается. Пароли, alias и ключи в файлы проекта не записываются.

Обязательные переменные:

```text
FINNI_RELEASE_STORE_FILE
FINNI_RELEASE_STORE_PASSWORD
FINNI_RELEASE_KEY_ALIAS
FINNI_RELEASE_KEY_PASSWORD
```

Владелец публикации создаёт постоянный ключ один раз, вне репозитория:

```powershell
keytool -genkeypair -v -keystore C:\secure\finni-release.jks -alias finni -keyalg RSA -keysize 4096 -validity 10000
```

Не использовать debug key как production key. Сохранить keystore, alias и пароли в двух защищённых резервных копиях: без исходного ключа невозможно выпустить совместимое обновление приложения.

Подписанная сборка (пример со ссылками на secret manager/локальное хранилище):

```powershell
$env:FINNI_RELEASE_STORE_FILE='C:\secure\finni-release.jks'
$env:FINNI_RELEASE_STORE_PASSWORD='<from-secret-manager>'
$env:FINNI_RELEASE_KEY_ALIAS='finni'
$env:FINNI_RELEASE_KEY_PASSWORD='<from-secret-manager>'
pnpm android:release
```

Проверка после сборки:

```powershell
.\.tooling\android-sdk\build-tools\36.0.0\apksigner.bat verify --verbose --print-certs artifacts\android\Finni-1.0.0-release.apk
```

Для AAB:

```powershell
& "$env:JAVA_HOME\bin\jarsigner.exe" -verify -verbose -certs artifacts\android\Finni-1.0.0-release.aab
```

## RuStore — технический паспорт

| Поле | Значение |
|---|---|
| Название | Финни |
| Application ID | `ru.onesolution.finni` |
| Version name / code | `1.0.0` / `1` |
| Форм-фактор | Android phone, portrait |
| Minimum Android | Android 8.0 / API 26 |
| Target / compile SDK | API 36 / API 36 |
| Движок | Capacitor 8 + локальный SolidJS bundle |

- Игровое ядро работает offline; аккаунт, backend и cloud sync не требуются.
- Имя питомца, состояние игры, транзакции, прогресс, Demo и настройки хранятся локально в WebView `localStorage`.
- Приложение не заявляет сбор персональных данных, платежи, рекламу или аналитику.
- Нет обязательных runtime URL/API; INTERNET permission удалён.
- Reset создаёт новое локальное игровое состояние, Delete удаляет профиль; uninstall удаляет данные приложения средствами Android.
- В merged manifest единственная permission — автоматически созданная AndroidX signature-level `ru.onesolution.finni.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`; она не запрашивает согласие пользователя.
- Целевая аудитория продукта: дети 7–11 лет; итоговые возрастная маркировка и тексты карточки подтверждаются владельцем при публикации.

## Чек-лист релиза

Статусы относятся к артефактам версии 1.0.0. Browser QA подтверждает игровую логику, но не заменяет проверку установленного APK.

До релиза выполнено:

- [x] `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm e2e` — PASS.
- [x] `pnpm android:sync`; Gradle debug APK; Gradle release APK и AAB (unsigned) — PASS.
- [x] APK zipalign, package/version/SDK и manifest audit; bundle audit без source maps и исходников.
- [x] Permission audit: нет INTERNET, storage, location, camera, contacts, microphone, ads/analytics.
- [x] `allowBackup=false`, `usesCleartextTraffic=false`, portrait, minSdk 26, targetSdk 36.

Остаётся за владельцем:

- [ ] Создать и безопасно сохранить production keystore.
- [ ] Подписать release APK/AAB постоянным ключом и повторно проверить `apksigner`/`jarsigner`.
- [ ] Physical-device acceptance: offline gameplay, background/resume/process kill, back, клавиатура, safe areas, icon/splash.
- [ ] Увеличить `versionCode` для следующей публикации.
- [ ] RuStore: карточка, возрастная маркировка, политика, загрузка.

## Важные свойства

- `android.overridePathCheck=true` нужен только из-за кириллицы в пути рабочего каталога на Windows.
- `scripts/android-gradle.mjs` автоматически использует `.tooling` и хранит Gradle cache в `.tooling/gradle-home`.
- Activity зафиксирована в portrait и использует `adjustResize` для клавиатуры.
- `allowBackup=false`, `usesCleartextTraffic=false`; INTERNET permission удалён.
- `pnpm android:sync` не перезаписывает ручные Android manifest/Gradle/theme настройки.
