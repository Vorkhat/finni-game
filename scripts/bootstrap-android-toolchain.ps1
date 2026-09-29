param(
    [string]$ToolRoot = (Join-Path $PSScriptRoot '..\.tooling')
)

$ErrorActionPreference = 'Stop'
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$toolRootFull = [IO.Path]::GetFullPath($ToolRoot)
if (-not $toolRootFull.StartsWith($repoRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw "ToolRoot must remain inside the repository: $toolRootFull"
}

$downloads = Join-Path $toolRootFull 'downloads'
$jdkContainer = Join-Path $toolRootFull 'jdk'
$sdkRoot = Join-Path $toolRootFull 'android-sdk'
New-Item -ItemType Directory -Force -Path $downloads, $jdkContainer, $sdkRoot | Out-Null

function Get-Sha256([string]$Path) {
    $sha256 = [Security.Cryptography.SHA256]::Create()
    $stream = [IO.File]::OpenRead($Path)
    try {
        return -join ($sha256.ComputeHash($stream) | ForEach-Object { $_.ToString('x2') })
    } finally {
        $stream.Dispose()
        $sha256.Dispose()
    }
}

$jdkArchive = Join-Path $downloads 'microsoft-jdk-21.0.12.1-windows-x64.zip'
$jdkChecksum = Join-Path $downloads 'microsoft-jdk-21.0.12.1-windows-x64.zip.sha256sum.txt'
if (-not (Test-Path -LiteralPath $jdkArchive)) {
    Invoke-WebRequest -UseBasicParsing -Uri 'https://aka.ms/download-jdk/microsoft-jdk-21.0.12.1-windows-x64.zip' -OutFile $jdkArchive
}
if (-not (Test-Path -LiteralPath $jdkChecksum)) {
    Invoke-WebRequest -UseBasicParsing -Uri 'https://aka.ms/download-jdk/microsoft-jdk-21.0.12.1-windows-x64.zip.sha256sum.txt' -OutFile $jdkChecksum
}
$expectedJdkHash = ((Get-Content -LiteralPath $jdkChecksum -Raw).Trim() -split '\s+')[0].ToLowerInvariant()
$actualJdkHash = Get-Sha256 $jdkArchive
if ($actualJdkHash -ne $expectedJdkHash) { throw 'Microsoft OpenJDK archive checksum mismatch.' }

$java = Get-ChildItem -LiteralPath $jdkContainer -Filter java.exe -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $java) {
    Expand-Archive -LiteralPath $jdkArchive -DestinationPath $jdkContainer -Force
    $java = Get-ChildItem -LiteralPath $jdkContainer -Filter java.exe -Recurse | Where-Object { $_.FullName -match '\\bin\\java\.exe$' } | Select-Object -First 1
}
if (-not $java) { throw 'JDK extraction did not produce bin\java.exe.' }
$env:JAVA_HOME = Split-Path -Parent (Split-Path -Parent $java.FullName)

$toolsArchive = Join-Path $downloads 'commandlinetools-win-15859902_latest.zip'
$expectedToolsHash = '90ae805d20434428bffcb699c290860f19bb5f66a67e6b330067e3de801fb04a'
if (-not (Test-Path -LiteralPath $toolsArchive)) {
    Invoke-WebRequest -UseBasicParsing -Uri 'https://dl.google.com/android/repository/commandlinetools-win-15859902_latest.zip' -OutFile $toolsArchive
}
$actualToolsHash = Get-Sha256 $toolsArchive
if ($actualToolsHash -ne $expectedToolsHash) { throw 'Android command-line tools archive checksum mismatch.' }

$sdkManager = Join-Path $sdkRoot 'cmdline-tools\latest\bin\sdkmanager.bat'
if (-not (Test-Path -LiteralPath $sdkManager)) {
    $extractRoot = Join-Path $toolRootFull 'android-commandline-extract'
    if (Test-Path -LiteralPath $extractRoot) { Remove-Item -LiteralPath $extractRoot -Recurse -Force }
    Expand-Archive -LiteralPath $toolsArchive -DestinationPath $extractRoot -Force
    $latestRoot = Join-Path $sdkRoot 'cmdline-tools\latest'
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $latestRoot) | Out-Null
    Move-Item -LiteralPath (Join-Path $extractRoot 'cmdline-tools') -Destination $latestRoot
    Remove-Item -LiteralPath $extractRoot -Recurse -Force
}

$env:ANDROID_HOME = $sdkRoot
$env:ANDROID_SDK_ROOT = $sdkRoot
$licenseAnswers = 1..100 | ForEach-Object { 'y' }
$licenseAnswers | & $sdkManager "--sdk_root=$sdkRoot" --licenses | Out-Host
if ($LASTEXITCODE -ne 0) { throw "sdkmanager --licenses failed with exit code $LASTEXITCODE" }

& $sdkManager "--sdk_root=$sdkRoot" 'platform-tools' 'platforms;android-36' 'build-tools;36.0.0'
if ($LASTEXITCODE -ne 0) { throw "sdkmanager package install failed with exit code $LASTEXITCODE" }

$escapedSdkRoot = $sdkRoot.Replace('\', '/')
[IO.File]::WriteAllText((Join-Path $repoRoot 'android\local.properties'), "sdk.dir=$escapedSdkRoot`n")

& $java.FullName -version
& $sdkManager "--sdk_root=$sdkRoot" --list_installed
Write-Host "Portable Android toolchain ready at $toolRootFull"
