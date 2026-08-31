param(
  [switch]$Release,
  [switch]$SyncOnly
)

$ErrorActionPreference = 'Stop'
if ($Release -and $SyncOnly) { throw '-Release and -SyncOnly cannot be used together.' }
$projectRoot = Split-Path -Parent $PSScriptRoot
$androidRoot = Join-Path $projectRoot 'android'
$sdkCandidates = @(
  $env:ANDROID_HOME,
  $env:ANDROID_SDK_ROOT,
  (Join-Path $env:LOCALAPPDATA 'Android\Sdk')
) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }
$jdkCandidates = @(
  $env:JAVA_HOME,
  (Join-Path $env:LOCALAPPDATA 'Programs\Temurin-21'),
  'C:\Program Files\Java\jdk-21'
) | Where-Object { $_ -and (Test-Path -LiteralPath (Join-Path $_ 'bin\java.exe')) }
$androidSdk = $sdkCandidates | Select-Object -First 1
$javaHome = $jdkCandidates | Select-Object -First 1

if (-not $androidSdk) { throw 'Android SDK not found. Set ANDROID_HOME or install Android Studio with API 36.' }
if (-not $javaHome) { throw 'A supported JDK was not found. Set JAVA_HOME or install JDK 21.' }
$env:ANDROID_HOME = $androidSdk
$env:ANDROID_SDK_ROOT = $androidSdk
$env:JAVA_HOME = $javaHome

Push-Location $projectRoot
try {
  npm run build
  npx cap sync android
  if ($SyncOnly) { return }
  Push-Location $androidRoot
  try {
    $task = if ($Release) { ':app:assembleRelease' } else { ':app:assembleDebug' }
    .\gradlew.bat $task --no-daemon
  } finally { Pop-Location }
} finally { Pop-Location }
