# Orbit Control Android app

This directory contains the Trusted Web Activity wrapper used to publish
`https://www.orbit-surplus.com/` on Google Play.

## Identity

- Application ID: `com.orbitcontrol.automation`
- App name: `Orbit Control Automation`
- Launcher name: `Orbit`
- Version code: `1`
- Version name: `1`

The application ID must not change after the first Play Console upload.

## Build requirements

- JDK 17
- Android SDK Platform 36
- Android SDK Build Tools 36.0.0

Create an upload key named `android.keystore` in this directory with the alias
`orbit-control-upload`. The key is intentionally ignored by Git and must be
stored securely outside the repository.

Build an Android App Bundle with:

```bash
./gradlew :app:bundleRelease
```

The unsigned bundle can be built without a key. A release uploaded to Google
Play must be signed with the protected upload key.

## Trusted Web Activity verification

After Google Play creates the app and exposes the Play App Signing SHA-256
certificate fingerprint, publish a Digital Asset Links file at:

`https://www.orbit-surplus.com/.well-known/assetlinks.json`

The association must use the package name `com.orbitcontrol.automation` and
the Play App Signing certificate fingerprint. Do not use a placeholder
fingerprint.
