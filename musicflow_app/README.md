# MusicFlow App

Flutter client for MusicFlow.

## API Environment

The app reads the backend host from the compile-time variable `API_BASE_URL`:

```dart
String.fromEnvironment("API_BASE_URL")
```

If you do not pass this value, the app falls back to the production backend in
`lib/core/config/api_config.dart` (`APP_ENV` defaults to `prod`).

## Run Development

Use your computer LAN IP when running on a physical phone:

```bash
flutter run --dart-define=APP_ENV=dev
flutter run --dart-define=API_BASE_URL=http://192.168.1.53:5001
```

If you changed the backend dev port, update the URL accordingly.

## Build Production

For production builds, use `APP_ENV=prod` to select `baseUrlProd` from
`lib/core/config/api_config.dart`.

```bash
flutter build apk --release --dart-define=APP_ENV=prod
```

You can still override the URL directly when needed. Do not include `/api`,
because the app endpoints already append `/api/...`.

```bash
flutter build apk --release --dart-define=API_BASE_URL=https://music-flow-30us.onrender.com
flutter build appbundle --release --dart-define=APP_ENV=prod
```

## Quick Checks

- Backend must be reachable from the device browser at `https://your-backend-domain.onrender.com/api/songs`.
- For Android release, use HTTPS in production.
- If using Google Sign-In, configure the production OAuth client/origins in Google Cloud.
