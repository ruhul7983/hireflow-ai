# HireFlow AI: backend

A chat-first AI recruiting co-worker. A recruiter talks to it to run hiring from job description to hire:

JD → Job → Sourcing → Review → Outreach → AI replies → Meeting booked → Interview → Shortlist → Hired → Stats

This is the API, the AI agent and the background workers. The web app is in [`client/`](../client/README.md).

## Run it

You need your own OpenAI key and Serper key. Everything else is optional.

### With Docker

From the repository root:

```bash
cp backend/.env.example backend/.env
```

Fill in `OPEN_AI_API_KEY`, `SERPER_API_KEY`, `JWT_SECRET`, `JWT_REFRESH_SECRET` and `ADMIN_PASSWORD`, then:

```bash
docker compose up --build
```

This starts Postgres, Redis, the backend and the client. Open <http://localhost:3000> and sign in with `ADMIN_EMAIL` and `ADMIN_PASSWORD`. Migrations and the admin seed run when the backend starts. Set `CLIENT_PORT` to use a different port.

Database and queue data are saved in `data/` at the repository root, so they survive `docker compose down`.

### Without Docker

You need Node 22, Postgres and Redis running.

```bash
cp .env.example .env
npm install
npx prisma migrate deploy
npx prisma generate
npm run seed
npm run start:dev
```

The API listens on port 5000. Then start the [client](../client/README.md).

### Try the flow

Sample data is in `prisma/sample-data/`.

1. Paste `sample-job-description.txt` into the chat and confirm the job.
2. Run a web search, or upload `sample-candidates.csv`. It includes a duplicate and a row with no contact details, to show both being handled.
3. Say "accept the top 3", then "set up outreach".
4. Approve the drafts. Set `OUTREACH_DAY_SECONDS=20` to see follow-ups go out in seconds.
5. Use **Simulate reply** on a sent email, then approve the drafted response.
6. If the reply asked for a meeting, open the booking link and pick a time.
7. Say "mark Ayesha as interviewed", then shortlisted, then hired, or use the status control on the Candidates page.
8. Ask "how is the job going?", and open the dashboard.

## Architecture

```text
Browser ──▶ Next.js client ──/api rewrite──▶ NestJS API ──▶ Postgres (Prisma)
   ▲                                            │
   └───────── SSE ◀── Redis pub/sub ◀───────────┤
                                                ▼
                                       BullMQ queues on Redis
                                       ├─ sourcing: search, dedupe, score
                                       ├─ outreach: draft, dispatch, send
                                       └─ replies: read, send
```

| Folder | What it holds |
| --- | --- |
| `src/chat` | Agent, confirmation gate, candidates, status rules, SSE |
| `src/campaign-setup` | LangGraph human-in-the-loop setup for outreach |
| `src/sourcing` | Serper search, CSV column matching, dedupe, scoring |
| `src/outreach` | Drafting, the send dispatcher, email |
| `src/replies` | Reply classification, drafts, auto-reply rules |
| `src/meetings` | Booking links and the mock time-slot picker |
| `src/jobs`, `src/dashboard` | Lists, funnel and AI usage |
| `src/llm` | OpenAI client, usage recording, untrusted text handling |

Chat cards are stored as a type plus foreign keys, and the UI rebuilds each card from the live rows, so a card always shows current data. There are no JSON columns anywhere in the schema.

## How the agent works

The agent is a LangChain tool-calling loop in `src/chat/agent.service.ts`. The tools are defined with LangChain's `tool()` and zod schemas in `src/chat/agent-tools.service.ts`, and bound to the model with `bindTools` in strict mode, so a call always matches its schema.

Tool names are snake_case `verb_noun`, and the verb says what a tool may do:

| Prefix | Meaning | Tools |
| --- | --- | --- |
| `read_`, `list_`, `get_` | Only look at data | `read_job_posting`, `list_jobs`, `list_candidates`, `list_campaigns`, `get_job_stats` |
| `propose_` | Only show a card to confirm | `propose_job`, `propose_sourcing`, `propose_candidate_decision`, `propose_candidate_status_change`, `propose_campaign_change` |
| `start_` | Hand over to a guided flow | `start_campaign_setup` |

**Confirmation is enforced in code, not in the prompt.** A write tool never writes. It creates a `PendingAction` row and shows a card, and only `ActionsService.confirm` runs the action. A chat "yes" or "no" is decided by a regular expression before the model is called, so nothing inside a job post or a candidate profile can talk the model into approving something.

**Campaigns can be controlled from chat.** `propose_campaign_change` can pause, resume or stop a campaign and change its daily limit, in one confirmed step such as "resume at 50 a day".

**Sending has no agent tool on purpose.** Campaigns are approved on the review card or with a chat "yes" to that card. Reply drafts are only approved on their own card, because each one is a specific email to a specific person.

**Campaign setup is a LangGraph graph.** It pauses with `interrupt()` on each question and shows button suggestions, then continues with `Command({ resume })`. Checkpoints live in Postgres as bytes through a custom saver, because the official saver needs JSONB. A paused setup survives a server restart.

## How background jobs work

All heavy work runs in BullMQ with three attempts and exponential backoff.

- **Sourcing** searches with Serper (`site:linkedin.com/in`), never scraping LinkedIn itself. It removes duplicates by email or profile URL, then scores in batches of 8. Retries only pick up unscored rows, so nothing is paid for twice.
- **Outreach** has a scheduler that runs every 5 seconds and queues whatever is due within the daily limit. Each send claims its row atomically. A unique constraint on step and candidate means nobody can receive the same step twice.
- **Replies** first stop follow-ups, before any model call. Then the reply is classified, the status is updated and a response is drafted.

Progress reaches the chat over SSE. Events go through Redis pub/sub, so they work across processes.

## Why this LLM and agent approach

- **OpenAI `gpt-4o-mini`.** It is cheap enough to score every candidate, and strict JSON schema output means a bad response fails in validation instead of reaching the recruiter. The model is set by `OPEN_AI_MODEL`.
- **LangChain tool calling for the agent.** Typed tools and strict schemas keep the calls valid, and the loop stays in our code so the confirmation gate sits outside the model.
- **LangGraph only for campaign setup.** This one flow really is a long-running, multi-question conversation that has to survive a restart, which is what `interrupt()` and checkpoints are for.
- **Scores are limited in code.** The model reports whether location, seniority and must-have skills are stated, and code caps the score at 75, 80 or 60 if not. The model alone was too generous.

## AI safety

- **Never inventing data.** Prompts allow only stated facts, and a draft with a placeholder such as `[Company]` fails and retries.
- **Prompt injection.** Outside text is wrapped in tags and treated as data, and our own tags are removed from it first so it can't close its block early. The confirmation gate means a successful injection still can't send or write anything.
- **Unsubscribe** is enforced in code. Nobody is emailed after it, whatever the model returns.

### Auto-reply

Off by default, per job, from the Jobs page. Turning it on or off is recorded in the activity log. With it on, a reply is only sent without approval if all of these hold, checked in `src/replies/auto-reply.ts` and `replies.service.ts`:

- It was classified as Interested, Wants a meeting or Not interested. Questions always go to the recruiter.
- The model did not flag it for a recruiter, for example for a complaint or a question about money.
- The reply doesn't look like an attempt to steer the AI.
- The draft has no link, email address, price or number of three or more digits.
- The candidate hasn't reached a meeting or a later stage.
- This candidate hasn't had an auto-reply before, so two mail robots can't answer each other forever.
- The job has sent fewer than 20 in the last 24 hours.

Anything else waits for approval as usual.

## What is done, mocked and skipped

**Done:** everything in the core requirements, plus real email sending, pause and resume, auto-reply with safety rules, token and cost tracking per job, AI job summaries in chat, and prompt injection protection. Jobs, Candidates, Campaigns and Activity pages use server-side pagination.

**Mocked:**

| Service | Mock |
| --- | --- |
| Candidate inbox | `POST /simulate-reply` and a UI button. It is the same path a mail webhook would use. |
| Calendar | A generated time-slot picker instead of Calendly |
| Email | Sends to a throwaway [Ethereal](https://ethereal.email) inbox, with a preview link on each email, until `SMTP_USER` and `SMTP_PASS` are set. With them set, it sends real email. |

**Skipped:**

- Real inbox connection
- Rescheduling or cancelling a meeting in the app, and telling a candidate when a meeting is cancelled
- Timezones on booking slots, which use the server's timezone
- Closing a job, and user sign-up. The seed creates the admin account.

## Trade-offs

- **NestJS and Next.js instead of plain Express and React 18.** NestJS runs on Express and gave dependency injection and guards. Next.js 16 uses React 19. Postgres with Prisma replaced MongoDB, as agreed with HR, and suits the many relations here.
- **One service for API and workers.** It is simpler to run, but they can't scale separately yet. Splitting them only needs a second entry point.
- **Cards rebuilt from live rows.** The chat always shows the truth, at the cost of old cards changing as data moves on.
- **Dashboard funnel by furthest stage.** It comes from the activity log, so someone who left still counts for stages they reached. Exits are shown beside it.
- **Dashboard and lists refresh on load.** Only the chat is live.
- **Search uses `ILIKE`.** That is fine at this size, and a real deployment would add trigram indexes.
- **Background AI jobs use the OpenAI SDK directly** for strict JSON output, while the chat agent uses LangChain.
- **Costs use one price per token**, set in `.env`, and only count OpenAI calls made through `LlmService`. The small reader for typed answers in campaign setup isn't counted.
- **A wrong reply label** can be corrected with the status control, but the AI won't re-read the reply.
