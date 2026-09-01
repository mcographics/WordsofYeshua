# Words of Yeshua Android v0.1.1 — Corrective Test Build

This Android prerelease is a corrective installation build intended to diagnose and resolve the installation trouble reported with the first Android package.

## What changed

- Removed the unnecessary `REQUEST_INSTALL_PACKAGES` permission from the Android manifest. Words of Yeshua does not need this permission simply to be installed by Android.
- Rebuilt the Capacitor Android package from the checked-in generated Scripture catalogue.
- Corrected the GitHub Android build pipeline so APK builds no longer depend on missing Git LFS source objects during CI.
- Verified that the React production build, Capacitor Android synchronization, and Gradle APK assembly all complete successfully in GitHub Actions.
- Advanced the Android test version to **0.1.1** with version code **100001**.

## Why this is a prerelease

This corrective APK is **debug-signed for installation testing**. The original public Android v0.1.0 APK was signed with the project release key. Android requires updates to an installed app to use the same signing key, so this test build cannot be installed directly over the signed v0.1.0 release.

### Before installing

If Words of Yeshua Android v0.1.0 is already installed, uninstall it first, then install the v0.1.1 corrective APK.

Android may ask the browser or file manager used to open the APK for permission to install apps from that source. This is Android's normal sideloading confirmation.

## About the Google Play Store error

Words of Yeshua is distributed directly from GitHub and does not require the Google Play Store to install or run. This corrective build is intended to help determine whether the previous failure came from the APK/package configuration or from the phone's Play Store / Android package-installation services.

If this APK installs successfully after the previous version is removed, the earlier package path was likely involved. If the phone still reports that Google Play Store or a system installer component is stopping, the remaining issue is likely on the device rather than in the Words of Yeshua application package.

## Application details

- Package: `com.mcographics.wordsofyeshua`
- Android version: `0.1.1`
- Version code: `100001`
- Minimum Android: API 24
- Target Android: API 36
- Distribution: direct GitHub APK
- Release status: prerelease / corrective test build

The Bible reader, Words of Yeshua catalogue, search, saved passages, and preferences remain local-first and do not require an account, subscription, or cloud database.
