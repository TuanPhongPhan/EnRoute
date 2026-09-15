# EnRoute

EnRoute is a calm commute companion for Hochschule Neu-Ulm (HNU) students. It combines class schedules, live journey planning, and focused study support in a mobile-first Progressive Web App.

## Highlights

- **Today dashboard** with class-aware departure guidance and commute status
- **Week view** that blends upcoming classes with planned morning journeys
- **Journey planner** for route selection and commute details
- **Focus mode** with Pomodoro sessions and offline-safe progress syncing
- **Insights dashboard** for weekly university, travel, and focus metrics
- **Notifications and return-home planning** for commute-aware reminders

## Tech Stack

- **Framework:** Next.js 16 + React 19 + TypeScript
- **Styling:** Tailwind CSS 4
- **Data/Auth:** Supabase
- **Integrations:** Google Calendar OAuth, Transitous routing, Web Push
- **Testing:** Vitest + Playwright

## Getting Started

### 1) Prerequisites

- Node.js 20+
- npm 10+

### 2) Install dependencies

```bash
npm install
```

### 3) Configure environment variables

Copy the example file and fill in values:

```bash
cp .env.example .env.local
```

Required variables:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_OAUTH_REDIRECT_URI`
- `GOOGLE_TOKEN_ENCRYPTION_KEY`
- `TRANSITOUS_USER_AGENT`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`

### 4) Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Available Scripts

- `npm run dev` – start local development server
- `npm run build` – create production build
- `npm run start` – run production server
- `npm run lint` – run ESLint checks
- `npm run typecheck` – run TypeScript checks
- `npm run test` – run unit tests (Vitest)
- `npm run test:e2e` – run end-to-end tests (Playwright)
- `npm run test:preproduction` – run full quality gate (format, typecheck, lint, tests, build, e2e)

## Project Structure

- `/app` – Next.js App Router pages and API routes
- `/components` – UI and dashboard components
- `/lib` – domain logic, integrations, and client/server utilities
- `/supabase` – Supabase configuration, migrations, and functions
- `/tests/e2e` – Playwright end-to-end tests

## Deployment Notes

- Ensure production environment variables are set for Google Calendar, Supabase, Transitous, and VAPID keys.
- For CI workflows running `test:preproduction`, set:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

## License

This project is licensed under the [MIT License](LICENSE).
