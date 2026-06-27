# 📅 Google Calendar Clone

A full-stack, production-grade Google Calendar clone built as a monorepo. Features JWT authentication, recurring events with per-instance exception overrides, drag-and-drop rescheduling, offline draft persistence, and automatic timezone detection.

> **Live demo credentials** — `test@calendar.dev` / `password123`

---

## Table of Contents

1. [Setup Instructions](#setup-instructions)
2. [Architecture Overview](#architecture-overview)
3. [Technology Choices](#technology-choices)
4. [Business Logic](#business-logic)
5. [Animations](#animations)
6. [Future Enhancements](#future-enhancements)
7. [Theory Questions](#theory-questions)

---

## Setup Instructions

### Prerequisites

| Tool | Version |
|------|---------|
| Node.js | ≥ 18.0.0 |
| npm | ≥ 8.0.0 |

### 1. Clone

```bash
git clone https://github.com/your-username/google-calendar-clone.git
cd google-calendar-clone
```

### 2. Install dependencies (all workspaces at once)

```bash
npm install
```

> This installs dependencies for the root, `shared`, `backend`, and `frontend` workspaces in a single command thanks to npm workspaces.

### 3. Configure environment variables

```bash
cp .env.example backend/.env
```

Edit `backend/.env` and fill in your values:

```dotenv
# Server
PORT=3001

# SQLite database path (relative to backend/)
DATABASE_URL=./data/calendar.db

# JWT — generate a secure secret:
#   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d

# CORS — must match the Vite dev server origin
CORS_ORIGIN=http://localhost:5173
```

### 4. Run database migrations (optional — auto-runs on first start)

The backend applies migrations automatically on startup via `initDatabase()`.
To run them standalone:

```bash
npm run db:migrate -w backend
```

This creates the SQLite file at `DATABASE_URL` and seeds the test user
(`test@calendar.dev` / `password123`).

### 5. Start the development servers

```bash
npm run dev
```

`concurrently` boots both servers simultaneously:

| Server | URL |
|--------|-----|
| Backend (Express) | http://localhost:3001 |
| Frontend (Vite) | http://localhost:5173 |

### 6. Build for production

```bash
npm run build
```

Builds the shared types, then the backend (`tsc`), then the frontend (`tsc && vite build`).
Frontend output lands in `frontend/dist/`.

### Available scripts (root)

| Command | Description |
|---------|-------------|
| `npm run dev` | Start backend + frontend concurrently |
| `npm run build` | Production build (all workspaces) |
| `npm run lint` | ESLint across all `.ts`/`.tsx` files |
| `npm run format` | Prettier write across all files |
| `npm run type-check -w frontend` | TypeScript check (frontend only) |
| `npm run type-check -w backend` | TypeScript check (backend only) |

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                        BROWSER                               │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                   React 18 + Vite                   │    │
│  │                                                     │    │
│  │  ┌──────────────┐  ┌────────────┐  ┌────────────┐  │    │
│  │  │  React Query │  │   Zustand  │  │   React    │  │    │
│  │  │  (server     │  │  (UI state │  │   Router   │  │    │
│  │  │   cache)     │  │   store)   │  │   v6       │  │    │
│  │  └──────┬───────┘  └──────┬─────┘  └─────┬──────┘  │    │
│  │         │                 │              │          │    │
│  │  ┌──────▼─────────────────▼──────────────▼──────┐  │    │
│  │  │              Views & Components               │  │    │
│  │  │  MonthView · WeekView · DayView · TimeGrid    │  │    │
│  │  │  EventModal · QuickCreatePopover · DraftBanner│  │    │
│  │  │  DraggableEventCard · DayColumn (dnd-kit)     │  │    │
│  │  └──────────────────────┬────────────────────────┘  │    │
│  │                         │  axios                    │    │
│  └─────────────────────────┼───────────────────────────┘    │
│                            │                                 │
└────────────────────────────┼─────────────────────────────────┘
                             │ HTTP/REST (Bearer JWT)
┌────────────────────────────▼─────────────────────────────────┐
│                   NODE.JS BACKEND (Express)                   │
│                                                               │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│  │  Auth       │  │  Events      │  │  Middleware           │ │
│  │  Router     │  │  Router      │  │  authenticate()       │ │
│  │             │  │              │  │  (JWT verify)         │ │
│  │  POST /login│  │  GET /events │  │                       │ │
│  │  POST /reg  │  │  POST /events│  │  Zod request          │ │
│  │  GET /me    │  │  PUT  /:id   │  │  validation           │ │
│  │  PATCH /me  │  │  PATCH /:id  │  │                       │ │
│  │             │  │  DELETE /:id │  └──────────────────────┘ │
│  └─────────────┘  │  PUT /:id/   │                           │
│                   │   exception/ │  ┌──────────────────────┐ │
│                   │   :origStart │  │  recurrence.ts       │ │
│                   └──────┬───────┘  │  (pure expander)     │ │
│                          │          └──────────────────────┘ │
└──────────────────────────┼───────────────────────────────────┘
                           │ better-sqlite3 (synchronous)
┌──────────────────────────▼───────────────────────────────────┐
│                    SQLite Database                            │
│                  (calendar.db — single file)                 │
│                                                              │
│  ┌──────────┐  ┌────────────────────┐  ┌──────────────────┐ │
│  │  users   │  │      events        │  │ event_exceptions │ │
│  │          │  │                    │  │                  │ │
│  │ id (PK)  │  │ id (PK)            │  │ id (PK)          │ │
│  │ email    │  │ user_id (FK)       │  │ event_id (FK)    │ │
│  │ pass_hash│  │ title              │  │ original_start   │ │
│  │ name     │  │ start_utc          │  │ new_start_utc    │ │
│  │ timezone │  │ end_utc            │  │ new_end_utc      │ │
│  │ created_at│ │ color              │  │ new_title        │ │
│  └──────────┘  │ is_all_day         │  │ is_deleted       │ │
│                │ recurrence_rule    │  └──────────────────┘ │
│                │ (JSON, nullable)   │                        │
│                └────────────────────┘                        │
│                 idx: user_id, start_utc, end_utc             │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                    @calendar/shared                          │
│          TypeScript interfaces used by both sides            │
│  User · Event · EventInstance · RecurrenceRule               │
│  CreateEventRequest · UpdateEventRequest · PatchEventRequest │
└──────────────────────────────────────────────────────────────┘
```

### Monorepo workspace layout

```
google-calendar-clone/
├── package.json          # Root workspace — scripts & devDependencies
├── tsconfig.json         # Root TS config (extended by workspaces)
├── .env.example          # Template for backend/.env
│
├── shared/               # @calendar/shared — shared TypeScript types
│   └── src/types.ts
│
├── backend/              # @calendar/backend — Express API
│   ├── src/
│   │   ├── db/           # SQLite connection, migrations, seed
│   │   ├── lib/          # recurrence.ts (pure expander)
│   │   ├── middleware/   # auth.ts (JWT verify)
│   │   └── routes/       # auth.ts, events.ts
│   └── data/             # SQLite .db file (git-ignored)
│
└── frontend/             # @calendar/frontend — React + Vite
    └── src/
        ├── components/
        │   ├── calendar/ # MonthView, WeekView, DayView, TimeGrid,
        │   │             # EventModal, DraftBanner, DraggableEventCard …
        │   └── layout/   # AppShell, AppHeader, Sidebar
        ├── context/      # AuthContext (JWT + timezone sync)
        ├── hooks/        # useMutateEventPatch, useEventDraft
        ├── lib/          # api.ts (axios), eventLayout.ts
        ├── pages/        # CalendarPage, LoginPage, RegisterPage
        └── store/        # calendarStore, eventFormStore (Zustand)
```

---

## Technology Choices

### Backend

| Library | Why |
|---------|-----|
| **Express 4** | Minimal, well-understood HTTP framework. No runtime overhead from a full framework. |
| **better-sqlite3** | Synchronous SQLite binding — zero async overhead, perfect for a single-server workload. Simple to set up, transactions are trivial, no connection pool needed. |
| **SQLite** | Zero-config embedded database. Perfect for a portfolio/demo project that needs to run with a single `npm run dev`. Easily swapped for Postgres in production by changing the DB adapter. |
| **jsonwebtoken + bcryptjs** | Industry-standard stateless auth. 7-day tokens stored in `localStorage`; bcrypt cost factor 12 gives ~300 ms hash time — enough to thwart brute-force without user-visible latency. |
| **Zod** | Runtime request validation with TypeScript inference. Catches malformed payloads before they reach business logic, and shares the same type vocabulary as the shared package. |
| **uuid v4** | Collision-free, URL-safe primary keys that don't expose row count or creation order. |

### Frontend

| Library | Why |
|---------|-----|
| **React 18** | Concurrent features (automatic batching, `startTransition`) keep the calendar responsive while heavy layout calculations run. |
| **Vite** | Sub-second HMR. Native ESM, no bundling in dev mode. Production build uses Rollup with automatic chunk splitting. |
| **@tanstack/react-query v5** | Declarative server-state management. Handles caching, background refetching, and stale-while-revalidate out of the box. Optimistic updates for drag-and-drop are a first-class pattern. |
| **Zustand** | Tiny (< 2 kB) client-state store. Chosen over Redux because the calendar's UI state (current date, view mode, form open/close) is shallow and doesn't need reducers. |
| **React Router v6** | Nested routes with data loaders. Used for `/login`, `/register`, and `/*` → `/calendar` redirect. |
| **date-fns v3** | Tree-shakeable, immutable date utilities. No prototype pollution, no global state. Used for all date arithmetic (addDays, format, isSameDay, startOfWeek, etc.). |
| **date-fns-tz** | IANA timezone conversion without shipping the full CLDR dataset. `toZonedTime()` converts UTC ISO strings to the user's local zone for rendering, while leaving stored values in UTC. |
| **@dnd-kit/core + @dnd-kit/modifiers** | Accessible, headless drag-and-drop primitives. Chosen over `react-beautiful-dnd` (unmaintained) and `react-dnd` (requires HTML5 DnD API which breaks on touch). The `PointerSensor` works across mouse and touch screens. The `restrictToWindowEdges` and custom `snapTo15Min` modifiers slot in cleanly. |
| **framer-motion** | Declarative animation API. Chosen over raw CSS transitions because it handles enter/exit lifecycles for React components (e.g. the modal unmounts before its exit animation would complete with plain CSS). |
| **axios** | Interceptors make it trivial to attach the `Authorization: Bearer <token>` header globally and redirect to `/login` on 401 without repeating that logic in every query function. |
| **lucide-react** | MIT-licensed, consistent icon set with first-class React bindings and tree-shaking. Equivalent to Google's Material icons but without the separate font download. |
| **Tailwind CSS v3** | Utility-first CSS. No stylesheet bloat — PurgeCSS removes unused classes at build time. The `@tailwindcss/forms` plugin normalises form inputs to a consistent baseline across browsers. |

---

## Business Logic

### UTC Storage Strategy

**Rule: all timestamps are stored and transmitted as UTC ISO 8601 strings.**

```
User's browser (Asia/Kolkata, UTC+5:30)
  ↓  user picks 10:00 AM local time
  ↓  EventModal converts: new Date("2024-06-01T10:00").toISOString()
  ↓  = "2024-06-01T04:30:00.000Z"   ← stored in events.start_utc

GET /api/events response → "2024-06-01T04:30:00.000Z"
  ↓  frontend: toZonedTime("2024-06-01T04:30:00.000Z", "Asia/Kolkata")
  ↓  = Date object representing 10:00 AM local  ← used for rendering
```

**Why UTC?** A user who travels from London (UTC+0) to New York (UTC-5) and opens the calendar on their phone should see their events at the correct wall-clock time in New York, not shifted by 5 hours. Storing UTC and converting on the client achieves this automatically.

**All-day events** are a special case: they store `00:00:00Z` but are displayed using the raw date string (not timezone-converted) to avoid the "all-day event shows on wrong day due to UTC offset" problem.

### Overlap Detection Algorithm

The backend checks for overlapping events before creating or updating:

```
New event:      [──────────)   start_utc → end_utc
Overlap if:         existing.start_utc < new.end_utc
                AND existing.end_utc   > new.start_utc
```

SQL query:
```sql
SELECT * FROM events
WHERE  user_id   = ?
  AND  id       != ?            -- exclude the event being edited
  AND  start_utc < ?            -- existing starts before new ends
  AND  end_utc   > ?            -- existing ends after new starts
LIMIT 1
```

If a conflict is found, the API returns **409 Conflict** with the conflicting event's title in `error.details.conflictingEvent`. The frontend shows a `ConflictDialog` allowing the user to force-save with `?force=true`.

### Recurrence Expansion Approach

Recurring events are stored once as a master row with a `recurrence_rule` JSON column:

```json
{ "freq": "WEEKLY", "interval": 1, "until": "2024-12-31T00:00:00.000Z" }
```

When `GET /api/events?start=…&end=…` is called, the backend:

1. **Fetches all master events** for the user within a generous range (start of first possible occurrence to range end).
2. **Fetches all exceptions** for those events in a single batch query.
3. **Runs `expandRecurring()`** — a pure, dependency-free function that:
   - Iterates a `cursor` Date starting from `master.start_utc`
   - Calls `advance(cursor, rule)` each iteration (mutates cursor in place) — O(n) where n = occurrences in range, not total series length
   - Applies a safety cap of **730 instances** per series (~2 years of daily events)
   - Overlays exceptions: deleted occurrences are skipped, modified occurrences use their `new_start_utc` / `new_end_utc` / `new_title`
4. Returns a flat `EventInstance[]` array — the frontend never needs to know which events are recurring.

**Why on-the-fly (not pre-expanded)?** Pre-expanding would bloat the DB with thousands of rows for every repeating event, and would require a background job to keep them in sync when the rule changes. On-the-fly expansion is pure computation with no I/O; for the ranges a calendar typically queries (a week, a month), it's consistently sub-millisecond.

### Timezone Conversion Flow

```
1. AuthContext on mount → GET /api/auth/me
   → compare user.timezone vs Intl.DateTimeFormat().resolvedOptions().timeZone
   → if different → PATCH /api/auth/users/me { timezone: detectedTz } (background)
   → user.timezone is updated in React state

2. TimeGrid / MonthView uses:
   const tz = user?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
   const localEvents = rawEvents.map(e => localizeEvent(e, tz));

3. localizeEvent(event, tz):
   localStart = toZonedTime(event.start_utc, tz)   // date-fns-tz
   localEnd   = toZonedTime(event.end_utc,   tz)

4. All layout math (topPercent, heightPercent, overlap grouping)
   uses localStart / localEnd — never raw UTC

5. TimeGrid footer displays:
   GMT offset badge  (e.g. "GMT+5:30")
   Full IANA name    (e.g. "Asia/Kolkata")
```

---

## Animations

All animations are implemented with **Framer Motion**.

| Interaction | Animation | Why Framer Motion |
|-------------|-----------|------------------|
| **Event modal open/close** | `y: 50 → 0, opacity: 0 → 1` (slide up from below) | Framer correctly waits for the exit animation (`y: 0 → 50`) to complete before unmounting the DOM node — impossible with plain CSS `transition` since React removes the element immediately on `isOpen = false`. |
| **Drag ghost overlay** | `opacity-90, scale-105, shadow-2xl` | The `DragOverlay` portal renders outside the scroll container, avoiding z-index and `overflow: hidden` clipping issues. |
| **Event cards** | `transition-[opacity,transform] duration-150` | Pure Tailwind CSS transitions are sufficient here — the element persists in the DOM, so no lifecycle management is needed. |
| **Draft banner** | `animate-slide-down` keyframe | CSS `@keyframes slideDown` defined in `tailwind.config.js`. The banner appears once on mount and never needs an exit animation. |

---

## Future Enhancements

### WebSocket Live Sync
Replace polling with a WebSocket channel (e.g. `socket.io` or native `ws`). When any client PATCHes an event, the server broadcasts `{ type: 'EVENT_UPDATED', data: EventInstance }` to all other sessions for that `user_id`. The frontend React Query client receives the message and calls `queryClient.setQueryData(['events', …], updater)` — no full refetch needed.

### Google Calendar API Import
Use the [Google Calendar API v3](https://developers.google.com/calendar/api) to import events from a user's Google account. The OAuth 2.0 flow would be handled server-side (client credentials stored in `.env`). Imported events would map `VEVENT` → our `events` schema, with `RRULE` → `recurrence_rule` JSON. A background sync job (cron or BullMQ queue) would keep the imported events fresh.

### Mobile App (React Native)
The `@calendar/shared` TypeScript types are already decoupled from any rendering layer. A React Native app could share the same types, the same `axios`-based API client, and the same Zustand stores. The only new code needed is platform-specific UI (calendar grid using `FlatList`, drag with `react-native-gesture-handler`, etc.).

### Additional Features
- **Invitation emails** — Nodemailer + invite tokens for sharing events with other users
- **Attachment support** — Upload PDFs/images to S3/R2, store URLs in the `description`
- **Search** — SQLite `FTS5` full-text index on `events(title, description)`
- **Export** — Generate `.ics` files (iCalendar format) for import into Apple Calendar / Outlook

---

## Theory Questions

### Q1: How would you scale to 1 million users?

**Database: sharding and indexing**

At 1M users with an average of 500 events each, the `events` table grows to ~500M rows — well beyond what a single SQLite file can serve efficiently. The migration path is:

1. **Move to PostgreSQL** (or CockroachDB for horizontal scale). Change the `better-sqlite3` adapter to `pg`; the SQL is ANSI-compatible.
2. **Composite index** on `(user_id, start_utc)`:
   ```sql
   CREATE INDEX idx_events_user_time ON events(user_id, start_utc, end_utc);
   ```
   Every calendar query is scoped to a single `user_id` and a time range, so this index makes the dominant query O(log N + k) where k = events in the visible range.
3. **Shard by `user_id`** (consistent hashing). Each shard holds a disjoint subset of users. A routing layer (e.g. Vitess, Citus, or a simple application-level shard map) directs requests to the correct shard. Recurring event expansion stays entirely within one shard since master events and their exceptions share the same `user_id`.
4. **Read replicas** for GET /events — calendar reads vastly outnumber writes. Route all `SELECT` queries to replicas; route `INSERT`/`UPDATE`/`DELETE` to the primary.

**Recurring events: pre-expansion vs. on-the-fly**

The current on-the-fly approach is correct at small scale. At 1M users:

- **On-the-fly stays preferable** for short ranges (day/week view) — expansion is O(occurrences in range), typically < 50 iterations.
- **Pre-expansion becomes worth it** for `month` view and search. A background worker materialises the next N occurrences into an `event_instances` table on creation/update of any recurring rule. Queries then hit the materialized table directly. Trade-off: the worker must re-expand whenever a rule changes.

**Conflict resolution: optimistic locking vs. last-write-wins**

The current system is last-write-wins (the last PATCH overwrites). At scale with collaborative editing:

- **Optimistic locking**: add `updated_at` (or a monotonic `version` column) to the `events` table. The PATCH body includes the `version` the client last saw. The SQL becomes:
  ```sql
  UPDATE events SET ... WHERE id = ? AND version = ?
  ```
  If `rowCount === 0`, the server returns **409 Conflict** — the client must re-fetch and re-apply its change. React Query's optimistic update + rollback pattern handles this cleanly on the frontend.
- **Operational Transform / CRDT** — overkill for a calendar; reserved for collaborative text editors.

**Caching layer**

Add Redis in front of GET /events responses:

```
key:   events:{user_id}:{start_utc_day}:{end_utc_day}
TTL:   60 seconds (short — calendar data changes frequently)
bust:  on any POST/PUT/PATCH/DELETE for that user_id
```

This absorbs repeated requests from multiple browser tabs open simultaneously.

---

### Q2: Frontend performance with thousands of events?

**Problem**: A user with 5,000 events visible in a month view tries to render 5,000 DOM nodes simultaneously. The browser layout engine stalls, and React's reconciliation becomes the bottleneck.

**Virtualized rendering with `react-window`**

Replace the flat `events.map(…)` in MonthView / TimeGrid with a windowed list:

```tsx
import { FixedSizeList } from 'react-window';

// Only render rows currently in the scrollport + a small overscan
<FixedSizeList
  height={viewportHeight}
  itemCount={weeks.length}
  itemSize={WEEK_ROW_HEIGHT}
  overscanCount={2}
>
  {({ index, style }) => <WeekRow week={weeks[index]} style={style} />}
</FixedSizeList>
```

In the day/week time-grid (24 hours × 60px = 1440px total), all hours are rendered but are very lightweight divs; virtualization is less critical there. The expensive part is event cards, which is bounded by the number of events visible on screen (usually < 20).

**Event clustering at low zoom levels**

For a "year view" or a heavily-loaded month view, implement dot-clustering:

- Group events by day-cell
- If a cell has > threshold (e.g. 5) events, render a coloured dot-bar summary instead of individual pills
- On click, expand to a popover showing the full list for that day

This reduces rendered DOM nodes from O(events) to O(days).

**Memoization**

```tsx
// Prevent WeekRow from re-rendering when unrelated state changes
const WeekRow = React.memo(({ week, events }: Props) => { … });

// Expensive layout calculation — only recompute when events or week changes
const placedEvents = useMemo(
  () => layoutWeek(week, localEvents),
  [week, localEvents]
);

// Stable callback reference — prevents child re-renders
const handleEventClick = useCallback((event, e) => {
  openModalEdit(event);
}, [openModalEdit]);
```

The key insight: `layoutWeek` is O(n log n) (sort + track assignment). With `useMemo`, it only runs when the event set for that week actually changes, not on every keystroke in an open form.

**API-level pagination**

Instead of fetching all events for a visible range in one request:

```
GET /api/events?start=…&end=…&limit=200&cursor=<last_event_id>
```

The frontend uses **infinite queries** (`useInfiniteQuery` from React Query):

```tsx
const { data, fetchNextPage } = useInfiniteQuery({
  queryKey: ['events', rangeKey],
  queryFn: ({ pageParam }) => fetchEvents({ ...range, cursor: pageParam }),
  getNextPageParam: (lastPage) => lastPage.nextCursor,
});
```

Events load progressively as the user scrolls, keeping initial render fast.

**Selector-based store access**

Zustand selectors prevent unnecessary re-renders:

```tsx
// BAD — subscribes to the entire store; re-renders on any store change
const store = useCalendarStore();

// GOOD — only re-renders when currentDate changes
const currentDate = useCalendarStore((s) => s.currentDate);
```

**Summary of techniques**

| Technique | Addresses |
|-----------|-----------|
| `react-window` virtualized list | Too many DOM nodes in month rows |
| Event clustering / dot summary | Overloaded day cells at scale |
| `React.memo` on week rows | Unnecessary re-renders from parent updates |
| `useMemo` on layout functions | Redundant O(n log n) computation |
| `useCallback` on handlers | Cascading re-renders in child event cards |
| Zustand selectors | Broad store subscription causing all views to re-render |
| Paginated API + `useInfiniteQuery` | Network / memory cost of loading all events at once |
