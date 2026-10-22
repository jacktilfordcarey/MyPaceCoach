# MyPace - AI Running Coach

MyPace is a full-stack running coach app that syncs your Strava data, analyzes weekly training load, and gives you AI-driven coaching, race predictions, and training plans based on your real activity history.

## Features

- Strava OAuth login and activity sync
- Weekly training analysis with load, ACWR, and training-quality metrics
- AI coach chat grounded in your recent sessions and goals
- Race-time prediction based on pace and heart-rate trends
- Personalized training-plan generation for upcoming blocks
- Goal tracking and personal best tracking
- Calendar-style event management for training planning

## Tech stack

- Frontend: React, Vite, Tailwind CSS, React Query, Recharts
- Backend: Node.js, Express, Sequelize, PostgreSQL
- AI: Anthropic as the primary model, OpenRouter as fallback
- Auth: Passport OAuth2 for Strava

## Project structure

- backend/ - Express API, Sequelize models, Strava sync, AI coach services
- frontend/ - Vite React app
- mobile/ - mobile app folder
- package.json - workspace root for running both apps together

## Prerequisites

Before you start, install:

- Node.js 18+
- PostgreSQL 14+
- A Strava developer app
- An Anthropic API key (primary LLM)
- Optional: an OpenRouter API key for fallback

## Local setup

### 1) Install dependencies

From the workspace root:

```bash
npm install
```

This installs the root workspaces and the backend/frontend dependencies.

### 2) Create the database

Start PostgreSQL locally and create a database named `mypace`.

Example with psql:

```bash
createdb mypace
```

If you are using a local Postgres user with a custom password, update the values in your `.env` file to match.

### 3) Create your environment file

Copy the example file:

```bash
cp backend/.env.example backend/.env
```

Then edit `backend/.env` and replace the placeholder values with your own settings.

Example variables:

```env
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:8081
SESSION_SECRET=replace-with-a-long-random-string

DB_HOST=localhost
DB_PORT=5432
DB_NAME=mypace
DB_USER=postgres
DB_PASSWORD=root

STRAVA_CLIENT_ID=your-strava-client-id
STRAVA_CLIENT_SECRET=your-strava-client-secret
STRAVA_CALLBACK_URL=http://localhost:3000/api/auth/strava/callback

LLM_PROVIDER=anthropic
LLM_FALLBACK_ENABLED=true
ANTHROPIC_API_KEY=your-anthropic-key
ANTHROPIC_MODEL=claude-sonnet-4-6
OPENROUTER_API_KEY=your-openrouter-key
OPENROUTER_MODEL=openai/gpt-oss-120b:free
```

### 4) Configure Strava OAuth

Create a Strava app at https://www.strava.com/settings/api and set the callback URL to:

```text
http://localhost:3000/api/auth/strava/callback
```

Then copy the client ID and secret into `backend/.env`.

### 5) Run the app

From the repo root:

```bash
npm run dev
```

This starts both apps together:

- Backend API: http://localhost:3000
- Frontend UI: http://localhost:8081

If you want to start them separately:

```bash
npm run dev --workspace=backend
npm run dev --workspace=frontend
```

## Useful development commands

```bash
# backend tests
npm run test --workspace=backend

# frontend build
npm run build --workspace=frontend

# backend start
npm run start --workspace=backend
```

## Notes

- The app uses PostgreSQL by default. If you use a remote database, set `DATABASE_URL` instead of the `DB_*` values.
- The backend will create the tables automatically on startup with Sequelize.
- If the AI API keys are missing, the backend can still boot, but the AI-powered coaching features will fail until keys are configured.
- The frontend dev server proxies `/api` requests to the backend on port 3000.

## Production / deployment notes

- Heroku is used in the current project config, and the root `package.json` includes the relevant `heroku-postbuild` command.
- In production, ensure all environment variables are set in the hosting platform and the app is configured to use secure cookies and the correct callback URLs.
