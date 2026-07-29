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

3. Build the signed release:
   ```bash
   ./gradlew assembleRelease
   ```
   Output: `app/build/outputs/apk/release/app-release.apk`

> **Keep `keystore.properties` and your `.jkeystore` file safe and out of version control** — they are excluded via `.gitignore`. Losing the keystore means you can never update the app on the Play Store.

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

## Project Structure

```
app/src/main/java/com/millionaire/game/
├── MainActivity.kt          # Entry point + sync
├── LoginActivity.kt         # User authentication + post-login sync
├── RegisterActivity.kt      # Account creation
├── GameActivity.kt          # Core game logic
├── CategorySelectActivity.kt # Pick category
├── LeaderboardActivity.kt   # Rankings (online + offline fallback)
├── ProfileActivity.kt       # User stats
├── data/
│   ├── Model.kt             # Data classes
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
    ├── NetworkUtil.kt      # Connectivity monitoring
    └── PrizeLadder.kt       # Prize amounts
```
