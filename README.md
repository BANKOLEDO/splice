# Splice

Real-time team communication bridge. Artifacts, threads, specs — connected.

Built by [dev_olabanks](https://devolabanks.xyz)

---

## What It Does

Splice lets teams create, discuss, and spec out work in one place. Think of it as a lightweight bridge between ideas and execution — you create an **artifact** (a spec, design, API, UI, task, or question), discuss it in a **thread**, and generate structured **specs** from the conversation.

## Features

- **Artifacts** — typed work items (spec, design, API, UI, task, question) with status tracking
- **Threads** — real-time discussion per artifact with role-colored messages
- **Spec Generation** — AI generates structured specs from thread conversations
- **Teams** — scoped workspaces with member management
- **Activity Feed** — live stream of creates, updates, and status changes
- **Status Workflow** — draft → needs review → approved / blocked → done
- **Search & Filter** — full-text search and type-based filtering of artifacts
- **Responsive** — desktop-friendly max-width 800px centered layout

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React Native / Expo + TypeScript |
| Navigation | React Navigation (Stack + custom tabs) |
| State | Zustand |
| Backend | Python / FastAPI |
| Database | SQLite |
| Auth | JWT (username + auto-generated password) |
| Real-time | WebSocket |

## Getting Started

### Backend

```bash
cd backend
pip install -r requirements.txt
python main.py
```

Server starts at `http://localhost:8000`.

### Frontend

```bash
cd frontend
npm install
npx expo start --web
```

Opens in browser at `http://localhost:8081`.

## Architecture

### Navigation

```
App
├── LoginScreen
└── NavigationContainer
    └── Stack
        ├── Main (MainTabs)
        │   ├── Home (artifact list + create)
        │   ├── Activity (event stream)
        │   └── Teams (manage teams)
        └── ArtifactDetail (thread + details + spec)
```

### Data Flow

- Auth token stored in Zustand (`authStore`)
- API calls read token via `useAuthStore.getState().token`
- WebSocket connects after login, sends auth message
- Artifacts scoped by `team_id` — fetched per active team
- Team switching updates `team_id` in store, triggers refetch

### Key Modules

| File | Purpose |
|------|---------|
| `frontend/App.tsx` | Root, navigation, auth flow |
| `frontend/src/screens/LoginScreen.tsx` | Username + role selection |
| `frontend/src/screens/MainTabs.tsx` | Bottom tab container |
| `frontend/src/screens/HomeScreen.tsx` | Artifact list, search, filter, create |
| `frontend/src/screens/ArtifactDetailScreen.tsx` | Thread, details, spec tabs |
| `frontend/src/screens/ActivityScreen.tsx` | Live activity feed |
| `frontend/src/screens/TeamsScreen.tsx` | Create, join, switch, delete teams |
| `frontend/src/components/ArtifactCard.tsx` | Artifact list card with accent bar |
| `frontend/src/components/ThreadView.tsx` | Message list + send input |
| `frontend/src/components/TabBar.tsx` | Custom animated bottom tab bar |
| `frontend/src/components/SkeletonCard.tsx` | Loading placeholder cards |
| `frontend/src/utils/api.ts` | HTTP client, all API calls |
| `frontend/src/utils/websocket.ts` | WebSocket client with reconnect |
| `frontend/src/store/authStore.ts` | Auth state (token, user, team) |
| `backend/main.py` | All API routes + WebSocket handler |
| `backend/auth.py` | Password hashing, JWT create/decode |
| `backend/database.py` | SQLite setup, migrations |
| `backend/models.py` | Pydantic request/response models |
| `backend/schema.sql` | Table definitions |

## API Endpoints

### Auth
- `POST /api/auth/register` — create account (auto-creates default team)
- `POST /api/auth/login` — get JWT token

### Artifacts
- `GET /api/artifacts` — list (filterable by status, type, team_id)
- `GET /api/artifacts/{id}` — get one
- `POST /api/artifacts` — create
- `PATCH /api/artifacts/{id}` — update status
- `DELETE /api/artifacts/{id}` — delete

### Threads & Messages
- `GET /api/artifacts/{id}/thread` — get thread with messages
- `POST /api/artifacts/{id}/messages` — add message
- `POST /api/threads/{id}/resolve` — resolve thread
- `POST /api/threads/{id}/unresolve` — reopen thread

### Teams
- `GET /api/teams` — list teams
- `POST /api/teams` — create team
- `DELETE /api/teams/{id}` — delete team (creator only)
- `POST /api/teams/{id}/join` — join team
- `GET /api/teams/{id}/members` — list members

### Spec Generation
- `POST /api/artifacts/{id}/generate-spec` — AI spec from thread

### Other
- `GET /api/stats` — workspace statistics
- `POST /api/upload` — file upload
- `GET /api/users/online` — online users
- `POST /api/artifacts/{id}/typing` — typing indicator
- `WebSocket /ws` — real-time events

## Design

- Dark theme: background `#0A0A0F`, cards `#14141E`, borders `#1C1C2E`
- Pill-shaped interactive elements (`borderRadius: 999`)
- Accent colors per artifact type and role
- Clean, deliberate — no glassmorphism, no unnecessary gradients
- Solid backgrounds with subtle border separation

## Credits

Built by [dev_olabanks](https://devolabanks.xyz)
