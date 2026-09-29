# Android build

## Зафиксированный стек

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

С постоянным ключом владельца та же Gradle-конфигурация подписывает release; см. `docs/android-signing.md`.

## Android Studio

```bash
pnpm android:open
```

Команда настроена, но в среде Этапа 5 не запускалась: Android Studio отсутствовал. CLI build полностью прошёл.

## Важные свойства

- `android.overridePathCheck=true` нужен только из-за кириллицы в пути рабочего каталога на Windows.
- `scripts/android-gradle.mjs` автоматически использует `.tooling` и хранит Gradle cache на D: в `.tooling/gradle-home`.
- Activity зафиксирована в portrait и использует `adjustResize` для клавиатуры.
- `allowBackup=false`, `usesCleartextTraffic=false`; INTERNET permission удалён.
- `pnpm android:sync` не перезаписывает ручные Android manifest/Gradle/theme настройки.
