# Millionaire — React Native (Android)

A React Native client for the [millionaire-game](../millionaire-game) backend —
"Who Wants to Be a Millionaire" trivia for Android.

Built with **React Native 0.86 (TypeScript)**, **React Navigation 7** and
**AsyncStorage** for session persistence. Talks to the existing Express/MySQL
API: auth, categories, 15-question games, lifelines, leaderboard and game
history.

## Features

- 🔐 **Accounts** — register / login, session restored on launch
- 🎮 **Full game** — 15 questions, prize ladder $100 → $1,000,000
- 🛟 **Safety nets** — $1,000 after question 5, $32,000 after question 10
- 🆘 **3 lifelines** — 50:50, Ask the Audience (animated poll), Phone a Friend
- 🚪 **Walk away** anytime with your guaranteed prize
- 🏆 **Leaderboard** — top scores or most wins
- 👤 **Profile** — stats + personal game history
- 🎲 **Category selection** — mixed or per-category (HK DSE subjects included)

## Prerequisites

- Node.js ≥ 22
- JDK 17 (e.g. Eclipse Temurin)
- Android SDK (platform 35+), installed via Android Studio
- Backend running: see `../millionaire-game/README.md` (`docker-compose up -d`,
  `npm run seed`, `npm start` — serves on port **8080**)

## Run

```bash
cd millionaire-rn
npm install
npx react-native run-android
```

The Metro bundler must also be running (`npm start` in another terminal) for
debug builds, or just run `run-android` and it will offer to start it.

### Pointing at the backend

The server URL can be changed **inside the app** — tap the ⚙️ gear icon on the
Home screen → **Server Settings**:

- Enter a URL (e.g. `http://192.168.1.50:8080`), **Save**, and optionally
  **Test Connection** — no rebuild needed.
- **Reset to Default** restores the built-in default.

The default lives in `src/config.ts` (`DEFAULT_API_BASE_URL`):

- **Android emulator**: `http://10.0.2.2:8080` — the emulator's alias for
  your PC's `localhost`.
- **Physical device**: your PC's LAN IP, e.g. `http://192.168.128.140:8080`.

Cleartext HTTP is enabled for **both** debug and release builds
(`android:usesCleartextTraffic="true"` in `AndroidManifest.xml`), so any
`http://` LAN address works out of the box. For a production build pointed at a
remote server, use `https://` instead (or tighten the manifest if you prefer).

## Build APKs

### Debug APK

```bash
cd millionaire-rn/android
./gradlew assembleDebug
```

Output: `android/app/build/outputs/apk/debug/app-debug.apk`
(debug-signed with `debug.keystore`, installable with `adb install`).

### Release APK (signed)

The release build is signed with the shared `millionaire-release.keystore`
(same signing identity as the native Android app):

```bash
cd millionaire-rn/android
./gradlew assembleRelease
```

Output: `android/app/build/outputs/apk/release/app-release.apk`

Signing setup:

- `android/app/millionaire-release.keystore` — the keystore file
- `android/keystore.properties` — store/key passwords + alias
  (`storeFile=app/millionaire-release.keystore`, `keyAlias=millionaire`)

> ⚠️ `keystore.properties` is **gitignored** — never commit it. Keep both files
> safe: the keystore is the only way to update the app in the future.
> `local.properties` (`sdk.dir=...`) is also required on machines with
> conflicting `ANDROID_HOME`/`ANDROID_SDK_ROOT` env vars — it is gitignored too.

Release builds bundle the JS (Hermes) during the Gradle build, so **Metro is
not needed**. Before shipping a release, point `API_BASE_URL` in `src/config.ts`
at your deployed backend (HTTPS) and rebuild.

Verify the signature (optional):

```bash
apksigner verify --verbose --print-certs app-release.apk
```

Install the APK on a connected device/emulator:

```bash
adb install android/app/build/outputs/apk/release/app-release.apk
```

## Project structure

```
millionaire-rn/
├── App.tsx                    # Navigation + auth-gated stacks
├── src/
│   ├── config.ts              # server URL (runtime-adjustable, default here)
│   ├── theme.ts               # colors, prize ladder, money formatting
│   ├── types.ts               # API + navigation types
│   ├── api/
│   │   ├── client.ts          # fetch wrapper (Bearer token, errors)
│   │   ├── auth.ts            # login / register / me / logout
│   │   └── game.ts            # categories / start / save / leaderboard
│   ├── db/
│   │   ├── database.ts        # SQLite schema + connection
│   │   ├── repository.ts      # typed SQL access (offline bank, result queue)
│   │   └── sync.ts            # server → SQLite sync + queued-result flush
│   ├── context/AuthContext.tsx
│   ├── components/            # ui, PrizeLadder, AudiencePoll
│   └── screens/               # Login, Register, Home, Category, Game,
│                              # Result, Leaderboard, Profile, Settings
└── android/                   # standard RN Android project
```

## Offline mode

The app can be played without internet by syncing the question bank into a
local SQLite database (`@op-engineering/op-sqlite`).

- **Sync**: Home screen → **📦 Offline data** → **🔄 Sync offline data**
  downloads all categories + questions from the server into SQLite. A one-time
  auto-sync also runs on first launch when the local bank is empty.
- **Offline play**: if the server is unreachable, the category list and game
  questions are served from local SQLite (a 📴 OFFLINE MODE banner shows).
- **Queued results**: games finished offline are saved into a `pending_results`
  table and uploaded automatically on the next successful sync.
- **Guest mode**: on the Login screen, **📴 Play offline (guest)** lets you
  play without an account — stats stay on the device and results upload on
  the next sync (as "Guest").

Storage layout: `src/db/` — `database.ts` (schema/open), `repository.ts`
(typed SQL access), `sync.ts` (fetch → SQLite + result queue).

## Tests & checks

```bash
npm test       # renders the full app tree (AsyncStorage mocked)
npx tsc --noEmit
```

## Notes vs the web client

- The web client's walk-away payout had an off-by-one (walking after question
  5/10 paid the *previous* safety level). The app implements the documented
  rule: walking away after reaching a safety net pays that net.
- Game statuses match the API: `won`, `lost`, `quit`.
