# Words of Yeshua Android v0.1.2 — Stable Production Update

Android v0.1.2 is the production follow-up to the v0.1.1 corrective test build. It carries forward the Android installation fixes while restoring the normal release-signing path required for seamless updates from the original signed Android v0.1.0 release.

## What changed

- Retains the corrected Android manifest and declares `REQUEST_INSTALL_PACKAGES` because the app's in-app updater opens Android's package installer.
- Builds the Android package from the checked-in generated Scripture catalogue, avoiding the missing Git LFS source objects that previously interrupted CI builds.
- Uses the production Android release signing configuration rather than the temporary debug signing used for v0.1.1 testing.
- Verifies the new APK's signing certificate against the original signed Android v0.1.0 APK before publication. The workflow refuses to publish if the signing identities do not match.
- Restores the `REQUEST_INSTALL_PACKAGES` permission required by the in-app GitHub updater, opens Android's per-app install-source settings when that permission has not been granted, and passes an explicit FileProvider URI grant to the package installer.
- Verifies the downloaded APK against GitHub's published SHA-256 asset digest before opening Android's installer, and publishes a matching `.apk.sha256` sidecar for manual downloads.
- Advances the Android version to **0.1.2** with version code **100002**.

## Updating from Android v0.1.0

If this release is signed with the same production key as v0.1.0, Android can install v0.1.2 as a normal update without uninstalling the existing app. Saved passages and device-local preferences remain in place during an ordinary update.

The v0.1.1 corrective test package was intentionally debug-signed and should not be treated as the production update path. If v0.1.1 is currently installed, uninstall that test build before installing this production-signed release.

## Installation

Download `Words-of-Yeshua-Android-0.1.2.apk` from this release and open it on the Android device. Android may ask the browser or file manager for permission to install apps from that source; this is the normal sideloading confirmation for APKs distributed outside Google Play.

Words of Yeshua is distributed directly through GitHub and does not require a Google Play Store listing to install or run.

## Application details

- Package: `com.mcographics.wordsofyeshua`
- Android version: `0.1.2`
- Version code: `100002`
- Minimum Android: API 24
- Target Android: API 36
- Distribution: direct GitHub APK
- Release status: stable production Android release

The Bible reader, Words of Yeshua catalogue, search, saved passages, and preferences remain local-first and do not require an account, subscription, or cloud database.
