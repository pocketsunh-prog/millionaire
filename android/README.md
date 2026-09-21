# Millionaire Game - Android App

Native Android version of the "Who Wants To Be A Millionaire?" trivia game.

## Architecture

- **Language:** Kotlin
- **Min SDK:** 24 (Android 7.0)
- **Target SDK:** 34 (Android 14)
- **Local DB:** SQLite (offline play)
- **Sync:** Retrofit REST API to MySQL backend
- **Pattern:** Activity-based with Repository pattern for data sync

## Features

- 🔄 **MySQL → SQLite Sync** — Fetches questions & categories from server, stores locally
- 🎮 **Full Game** — 15 questions, prize ladder ($100 → $1,000,000)
- 🛟 **3 Lifelines** — 50:50, Ask the Audience, Phone a Friend
- 🏆 **Leaderboard** — Global rankings synced from MySQL
- 👤 **User Accounts** — Register, login, profile with stats
- 📴 **Offline Play** — Once synced, play without internet
- 🎲 **Category Selection** — Mixed or single-category play
- 🔐 **Offline login** — Sign in without a connection using locally cached credentials
- 📋 **Category manager** — Enable, disable or delete categories in the offline database
- 🎵 **Music & sound effects** — Looping show music, answer stings and win/lose fanfares

## Prerequisites

- **JDK 17** — AGP 8.1.0 requires JDK 17. JDK 18+ will fail.
  - Download: [Eclipse Temurin JDK 17](https://adoptium.net/temurin/releases/?version=17)
- **Android SDK** — installed via Android Studio (compileSdk 34)
- **Gradle wrapper** — included (`gradlew` / `gradlew.bat`)

## Setup

1. Start the backend MySQL + Express server:
   ```bash
   cd ../millionaire-game
   docker-compose up -d
   npm start
   ```

2. Set `JAVA_HOME` to your JDK 17 install:
   - **Windows (PowerShell):**
     ```powershell
     $env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-17.0.19.10-hotspot"
     ```
   - **Windows (cmd):**
     ```bat
     set JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-17.0.19.10-hotspot
     ```
   - **macOS / Linux:**
     ```bash
     export JAVA_HOME=$(/usr/libexec/java_home -v 17)
     ```

3. Update `ApiClient.kt` BASE_URL if needed:
   - Emulator: `http://192.168.128.140:8080/` (default)
   - Physical device: `http://<your-pc-ip>:8080/`

4. Create `local.properties` with your SDK path (if building from CLI):
   ```properties
   sdk.dir=C\:\\Android\\Sdk
   ```

## Building

### Debug APK
```bash
./gradlew assembleDebug
```
Output: `app/build/outputs/apk/debug/app-debug.apk`

### Signed Release APK
1. Generate a signing keystore (first time only):
   ```bash
   keytool -genkeypair -v \
     -keystore app/millionaire-release.keystore \
     -keyalg RSA -keysize 2048 -validity 10000 \
     -alias millionaire \
     -storepass <your-password> -keypass <your-password> \
     -dname "CN=Millionaire Game, OU=Dev, O=Millionaire, C=US"
   ```

2. Create `keystore.properties` in the `android/` directory:
   ```properties
   storePassword=<your-password>
   keyPassword=<your-password>
   keyAlias=millionaire
   storeFile=app/millionaire-release.keystore
   ```

### Set `JAVA_HOME` to your JDK 17 install:
   - **Windows (PowerShell):**
     ```powershell
     $env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-17.0.19.10-hotspot"
     ```
   - **Windows (cmd):**
     ```bat
     set JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-17.0.19.10-hotspot
     ```
   - **macOS / Linux:**
     ```bash
     export JAVA_HOME=$(/usr/libexec/java_home -v 17)
     
3. Build the signed release:
   ```bash
   ./gradlew assembleRelease
   ```
   Output: `app/build/outputs/apk/release/app-release.apk`

> **Keep `keystore.properties` and your `.jkeystore` file safe and out of version control** — they are excluded via `.gitignore`. Losing the keystore means you can never update the app on the Play Store.

**Install on device:**
```bash
adb install app/build/outputs/apk/debug/app-debug.apk
adb install app/build/outputs/apk/release/app-release.apk
```

## Sync Flow

```
[MySQL DB] ← Express API → [ApiService/Retrofit] → [GameRepository] → [SQLite DB]
                                                                    ↓
                                                            [Game reads local data]
                                                                    ↓
[Server] ← POST game/save ← [SyncWorker / WorkManager] ← [saveGameSession] (synced=0)
```

- **After login** — categories + questions are pulled from the API into SQLite
- **Offline play** — once synced, the game runs entirely from the local DB
- **Game results** — saved locally (`synced=0`), pushed to server when online
- **Background sync** — WorkManager drains pending results every 15 min on network return
- **Leaderboard** — fetched live from the server; falls back to cached local rankings offline

## Offline login

A returning player can sign in with **no connection at all**.

- On every successful online login, `CredentialCache`
  (`util/CredentialCache.kt`) stores the account's email, username, a random
  per-account salt, `SHA-256(salt + "|" + password)`, the profile the server
  returned, and the auth token. **The plaintext password is never stored.**
- When the device is offline — or the server cannot be reached (an `IOException`,
  a wrong URL, a dead host) — `LoginActivity` verifies the typed credentials
  against that cache instead of giving up, restores the session and drops the
  user straight into the game with the locally cached question bank.
- A **wrong password answered by the server is never treated as "offline"**: only
  connectivity failures fall back to the cache, so an invalid password still
  fails normally.
- The Login screen shows a hint listing the accounts that can sign in offline
  (e.g. `📴 Offline login available for: you@example.com`).
- The session is flagged offline (`SessionManager.isOfflineSession()`), which
  MainActivity surfaces as a banner: results queue up and upload on the next
  successful online sign-in.
- Offline login is impossible for an account that has never signed in while
  connected — the app cannot know a password it has never seen. Use
  **Play as Guest** in that case.

## Managing offline categories

**Select Category → ⚙ MANAGE** (also reachable from **Settings → Manage
Categories**) manages what is stored in the local SQLite database:

| Action | Effect |
| --- | --- |
| **Disable** (switch) | Hides the category from the picker and from mixed games; its questions stay cached, so re-enabling is instant |
| **Delete** (button) | Removes the category **and its cached questions** from the device |
| **Restore** | Brings a deleted category back (its questions return on the next sync) |

Both choices are **remembered across server syncs**: `DatabaseHelper.insertCategories`
keeps the local `enabled` / `deleted` flags instead of overwriting them with the
server's values, and `insertQuestions` skips questions whose category was deleted —
so re-syncing cannot resurrect content you removed. The screen shows a running
tally (`4 enabled · 1 disabled · 1 deleted`).

Deleting is a soft delete in the local row plus a hard delete of the questions:
that is what lets the choice survive a later sync. A **peer sync** merges whole
rows from the other device and can therefore bring a deleted category back —
delete it again on this device if you do not want it.

## Audio

Background music and sound effects are generated from scratch by
`tools/generate-audio.js` — plain Node math, no samples, libraries or encoders —
and ship as 16-bit PCM mono WAVs (22 050 Hz) in `app/src/main/res/raw/`:

| Asset | Used for |
| --- | --- |
| `bgm_menu` | login, menus, category picker, results (seamless ~21 s loop) |
| `bgm_game` | the game board (seamless ~18 s loop) |
| `sfx_click` · `sfx_lock` · `sfx_suspense` | UI taps, answer locked, reveal riser |
| `sfx_correct` · `sfx_wrong` | answer verdict |
| `sfx_lifeline` | lifeline used |
| `sfx_win` · `sfx_lose` | final result |

Regenerate at any time (deterministic — identical bytes on every run):

```bash
node tools/generate-audio.js
```

Playback lives in `audio/SoundManager.kt`, initialised once from `MillionaireApp`:
a **SoundPool** for effects (preloaded, so the very first tap is not silent) and a
looping **MediaPlayer** for music. It pauses the music when the whole app leaves
the foreground (tracking started activities, so navigating between screens never
interrupts playback) and ducks/pauses when another app takes audio focus. The
WAVs are kept uncompressed in the APK (`androidResources { noCompress }`) so they
stream instead of being decoded twice. No third-party audio dependency is used.

Activities declare their music bed by implementing `BgmHost` (defaults to the
menu track; `GameActivity` overrides it with the game bed). The game wires the
show's signature beat: locking an answer ducks the music and plays a tension
riser, the verdict lands with the correct/wrong sting, then the music returns,
and game over plays the fanfare or the consolation sting.

Users control everything in **Settings → Audio**: music and effects switches,
independent volume sliders, and buttons to audition the stings. Preferences are
persisted in SharedPreferences.

> **Adding a sound:** create it in `tools/generate-audio.js`, regenerate, then add
> it to the `Sfx` enum in `SoundManager.kt`.

## Exporting & importing questions

**Settings → Export Questions** writes the offline question bank to a JSON file;
**Settings → Import Questions** reads one back in. Both use Android's Storage Access
Framework, so the user picks the save location / file — no storage permission needed.

**Export** (`data/io/QuestionIo.kt`):
- A dialog lets the user export **All types** or a single category; the category row(s)
  travel with the questions so they are meaningful on import.
- The system file creator opens with the default name `questions.json`; the user can
  rename it and choose any folder.
- Output is a self-contained, human-readable JSON document (stable snake_case keys that
  mirror the database columns, so it survives an R8 obfuscation):

```json
{
  "format": "millionaire_questions",
  "version": 1,
  "exported_at": "2026-09-21T06:04:54",
  "categories": [ { "id": 1, "name": "Science", ... } ],
  "questions": [ { "id": 1, "category_id": 1, "question": "...", "option_a": "...", ... } ]
}
```

**Import**:
- The system file picker filters to JSON.
- A confirmation dialog reports how many questions/categories the file holds before
  touching the database.
- Categories are added only if unknown locally (the user's `enabled`/`deleted`
  overrides are preserved). Questions use `INSERT OR IGNORE` by id, so any question
  already present is silently skipped — **re-importing the same file never creates
  duplicates**.
- A toast reports the result: `Imported 1 question · 83 duplicates skipped`.

Verified on a Pixel_10 emulator (Android 17): export produced valid JSON
(Node.js-validated: 84 questions, 6 categories); re-importing the same file kept the
count at 84 (duplicates skipped).

## Testing without the backend

The real backend needs Docker + MySQL. To exercise sync, offline login and the
category manager on an emulator without it, `tools/mock-api-server.js` serves a
compatible API (accounts are in memory):

```bash
node tools/mock-api-server.js 3000
```

Then in the app: **Settings → Server URL** → `http://10.0.2.2:3000/` (emulator) or
`http://<your-lan-ip>:3000/` (device) → **Test Connection**. Suggested run-through:
register + log in (caches credentials), disable/delete a category, restart and log
in again (the choices survive the content re-sync), then turn on airplane mode and
log in again to check offline login.


## Project Structure

```
app/src/main/java/com/millionaire/game/
├── MillionaireApp.kt         # Application; initialises the audio engine
├── MainActivity.kt          # Entry point + sync
├── LoginActivity.kt         # User authentication + post-login sync
├── RegisterActivity.kt      # Account creation
├── GameActivity.kt          # Core game logic
├── CategorySelectActivity.kt # Pick category
├── CategoryManagementActivity.kt # Enable / disable / delete offline categories
├── LeaderboardActivity.kt   # Rankings (online + offline fallback)
├── ProfileActivity.kt       # User stats
├── audio/
│   └── SoundManager.kt      # Music + sound-effect engine (BgmHost interface)
├── data/
│   ├── Model.kt             # Data classes
│   ├── io/QuestionIo.kt     # File export / import of the question bank
│   ├── db/DatabaseHelper.kt # SQLite management
│   ├── api/
│   │   ├── ApiClient.kt     # Retrofit singleton
│   │   └── ApiService.kt    # Retrofit endpoints
│   ├── repository/
│   │   └── GameRepository.kt # Offline-first data layer (DB + API)
│   └── sync/
│       └── SyncWorker.kt    # WorkManager background sync
└── util/
    ├── SessionManager.kt    # Auth session
    ├── CredentialCache.kt   # Cached credentials for offline login
    ├── NetworkUtil.kt      # Connectivity monitoring
    └── PrizeLadder.kt       # Prize amounts
```
