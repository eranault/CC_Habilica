# Streakr

Zero-punishment habit tracking for real humans.

## Philosophy

- **No punishment mechanics** — missing a habit never destroys your data or streak
- **Simple by default** — usable in under 60 seconds with no tutorial
- **Offline-first** — check-ins work with no internet, sync automatically on reconnect
- **Optional social** — accountability partners exist but are never forced
- **No gamification lock-in** — meaningful progress without RPG novelty

## Tech Stack

| Layer    | Technology                              |
|----------|-----------------------------------------|
| Frontend | React 18 + Vite + TailwindCSS           |
| Backend  | Node.js + Express                       |
| Database | SQLite (better-sqlite3), Postgres-ready |
| Auth     | JWT in httpOnly cookies                 |
| Offline  | Service Worker + IndexedDB queue        |
| Charts   | Recharts                                |
| Push     | Web Push API                            |

## Quick Start

### Prerequisites
- Node.js 20+
- npm 9+

### Development

```bash
# 1. Clone and install
git clone <repo>
cd streakr

# Root deps (concurrently)
npm install

# Frontend deps
cd client && npm install && cd ..

# Backend deps
cd server && npm install && cd ..

# 2. Configure environment
cp .env.example .env
# Edit .env — at minimum set JWT_SECRET

# 3. Run (both client + server concurrently)
npm run dev
```

- Frontend: http://localhost:5173
- API: http://localhost:3001/api

### Production (Docker)

```bash
cp .env.example .env
# Edit .env with production values

docker compose up -d
```

App runs at http://localhost:3001

## API Reference

```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me
POST   /api/auth/reset-password

GET    /api/habits
POST   /api/habits
PUT    /api/habits/:id
DELETE /api/habits/:id
PATCH  /api/habits/reorder
PATCH  /api/habits/:id/archive

POST   /api/checkins
DELETE /api/checkins/:id   (undo within 5 min)
GET    /api/checkins?habitId=&from=&to=

GET    /api/stats/summary
GET    /api/stats/heatmap?habitId=
GET    /api/stats/trends?habitId=&range=7d|30d|90d|all
GET    /api/stats/export

POST   /api/partners/invite
GET    /api/partners
DELETE /api/partners/:id
GET    /api/partners/:id/summary

POST   /api/notifications/subscribe
PUT    /api/notifications/:habitId
DELETE /api/notifications/:habitId
```

All responses follow `{ success: bool, data: {}, error: string | null }`.

## Project Structure

```
/
├── client/                  # Vite + React frontend
│   ├── src/
│   │   ├── components/      # Reusable UI
│   │   ├── pages/           # Route pages
│   │   ├── hooks/           # Custom hooks
│   │   ├── store/           # Zustand stores
│   │   ├── api/             # API layer
│   │   └── sw.js            # Service worker
├── server/                  # Express API
│   ├── routes/              # Route handlers
│   ├── middleware/          # Auth, validation, errors
│   ├── db/migrations/       # SQL migrations
│   └── services/            # Business logic
├── Dockerfile
├── docker-compose.yml
└── .env.example
```

## Environment Variables

See `.env.example` for all required variables.

## License

MIT
