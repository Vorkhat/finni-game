# Android release signing

## Что уже настроено

`android/app/build.gradle` читает только переменные окружения. Если задана хотя бы одна, но не все, сборка останавливается; если keystore не существует, сборка тоже останавливается. Пароли, alias и ключи в файлы проекта не записываются.

Обязательные переменные:

```text
FINNI_RELEASE_STORE_FILE
FINNI_RELEASE_STORE_PASSWORD
FINNI_RELEASE_KEY_ALIAS
FINNI_RELEASE_KEY_PASSWORD
```

## Создание постоянного ключа владельцем

Выполняет владелец публикации один раз, вне репозитория:

```powershell
keytool -genkeypair -v -keystore C:\secure\finni-release.jks -alias finni -keyalg RSA -keysize 4096 -validity 10000
```

Не использовать debug key как production key. Сохранить keystore, alias и пароли в двух защищённых резервных копиях: без исходного ключа невозможно выпустить совместимое обновление приложения.

## Подписанная сборка

Пример только со ссылками на secret manager/локальное защищённое хранилище:

```powershell
$env:FINNI_RELEASE_STORE_FILE='C:\secure\finni-release.jks'
$env:FINNI_RELEASE_STORE_PASSWORD='<from-secret-manager>'
$env:FINNI_RELEASE_KEY_ALIAS='finni'
$env:FINNI_RELEASE_KEY_PASSWORD='<from-secret-manager>'
pnpm android:release
```

После сборки проверить:

```powershell
.\.tooling\android-sdk\build-tools\36.0.0\apksigner.bat verify --verbose --print-certs artifacts\android\Finni-1.0.0-release.apk
```

Для AAB:

```powershell
& "$env:JAVA_HOME\bin\jarsigner.exe" -verify -verbose -certs artifacts\android\Finni-1.0.0-release.aab
```

## Статус Этапа 5

- Debug APK: подписан debug certificate, audit PASS.
- Release APK: собран, выровнен, unsigned.
- Release AAB: собран, unsigned (`jar is unsigned`).
- Production keystore: не создан — требуется владелец и защищённое хранение.
