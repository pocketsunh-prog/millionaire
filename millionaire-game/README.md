# Who Wants to Be a Millionaire - 3D Edition

A fully-featured "Who Wants to Be a Millionaire" trivia game built with Node.js, Three.js, and MySQL on Docker.

## Features

- **3D Background** - Immersive Three.js animated stage with rotating rings, particle effects, and star field
- **100 Questions** - Across 8 categories: Science, History, Geography, Entertainment, Sports, Technology, Literature, General Knowledge
- **Category Selection** - Play with mixed categories or focus on one
- **3 Lifelines** - 50:50, Ask the Audience, Phone a Friend
- **Prize Ladder** - $100 to $1,000,000 with safety nets at $1,000 and $32,000
- **User Accounts** - Register/login with avatars, persistent stats tracking
- **Leaderboard** - Global rankings by top score or most wins
- **Profile** - Personal stats, game history, win rate
- **Sound Effects** - Synthesized audio via Web Audio API (no external files)
- **Responsive Design** - Works on desktop and mobile

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop)
- [Node.js](https://nodejs.org/) (v16+)

## Quick Start

### 1. Start MySQL with Docker

```bash
cd millionaire-game
docker-compose up -d
```

This starts MySQL 8.0 on port 3306 with the database `millionaire` and auto-creates the schema.

### 2. Install Dependencies & Seed Database

```bash
npm install
npm run seed
```

This inserts 100 questions across 8 categories into the database.

### 3. Start the Server

```bash
npm start
```

### 4. Play!

Open your browser at: **http://localhost:8080**

## Project Structure

```
millionaire-game/
├── docker-compose.yml      # MySQL Docker configuration
├── server.js               # Express API server (with auth)
├── package.json
├── .env                    # Database configuration
├── db/
│   ├── schema.sql          # DB schema (users, questions, sessions)
│   └── seed.js             # 100 trivia questions seeder
└── public/
    ├── index.html          # Game UI
    ├── css/
    │   └── style.css       # Game styling
    └── js/
        ├── game.js         # Three.js 3D scene + game logic
        ├── audio.js        # Web Audio API sound system
        └── auth.js         # Authentication manager
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create new account |
| POST | `/api/auth/login` | Login and get token |
| POST | `/api/auth/logout` | Invalidate session |
| GET | `/api/auth/me` | Get current user info |
| PUT | `/api/auth/avatar` | Update user avatar |
| GET | `/api/categories` | List all categories |
| GET | `/api/game/start?category=X` | Start a game session with random questions |
| GET | `/api/questions?category=X&difficulty=X` | Get questions with filters |
| GET | `/api/leaderboard?type=score\|wins` | Get top players |
| GET | `/api/leaderboard/history` | Get personal game history |
| GET | `/api/stats` | Get question count by category |
| POST | `/api/game/save` | Save game result |

## Database Schema

- **categories** - 8 trivia categories
- **questions** - 100 questions with 4 options each, linked to categories
- **users** - Player accounts with stats (games, wins, best score)
- **user_sessions** - Auth tokens for logged-in users
- **game_sessions** - Individual game results linked to users
