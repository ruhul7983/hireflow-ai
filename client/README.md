# HireFlow AI: client

The web app for HireFlow AI, a chat-first AI recruiting co-worker. It is built with Next.js 16, React 19, TypeScript and Tailwind CSS.

The architecture, agent design, trade-offs and what is mocked are in the [backend README](../backend/README.md).

## Run it

Start the [backend](../backend/README.md) first, or use `docker compose up --build` from the repository root to run everything.

```bash
cp .env.example .env
npm install
npm run dev
```

Open <http://localhost:3000> and sign in with the admin account from the backend's `.env`.

`BACKEND_URL` is read at build time for the `/api` rewrite, so rebuild after changing it.

## How it's put together

| Route | What it does |
| --- | --- |
| `/chat` | The main workspace, with interactive cards and live progress over SSE |
| `/` | Dashboard with the funnel, reply rate, interested rate, meetings and hires per job |
| `/jobs`, `/candidates`, `/campaigns`, `/activity` | Lists with server-side pagination, search and filters |
| `/book/[token]` | Public booking page for candidates |
| `/login` | Sign in |

- **Lists keep their state in the URL.** The server renders each page of rows, so refresh, links and the back button all land on the same view. The shared pieces are in `components/list/`.
- **Requests go through `/api`.** It rewrites to the backend, which keeps session cookies first-party. `lib/api.ts` renews an expired session once and retries.
- **Loading states are skeletons** that match the real layout, so the page doesn't jump.
