# HireFlow AI

A chat-first AI recruiting co-worker that runs hiring from job description to hire. Built for the Aironauts AI Engineer technical assignment.

- [`backend/`](backend/README.md): API, AI agent and background jobs. **This README covers the architecture, agent design, what is mocked and the trade-offs.**
- [`client/`](client/README.md): the web app.

## Quick start

You need Docker, an OpenAI key and a Serper key.

```bash
cp backend/.env.example backend/.env
```

Fill in `OPEN_AI_API_KEY`, `SERPER_API_KEY`, `JWT_SECRET`, `JWT_REFRESH_SECRET` and `ADMIN_PASSWORD`, then:

```bash
docker compose up --build
```

This one command starts everything: Postgres, Redis with the BullMQ queues, the backend and the client. Open <http://localhost:3000> and sign in with `ADMIN_EMAIL` and `ADMIN_PASSWORD`.

## Your data

Database and queue data are saved in a `data/` folder in this project, so they're still there after `docker compose down` or a restart. It isn't committed to git.

To start again with an empty database, stop the app and delete the folder. Docker creates its files as another user, so this needs `sudo`:

```bash
docker compose down
```

```bash
sudo rm -rf data
```

To run without Docker, see the [backend](backend/README.md#without-docker) and [client](client/README.md#run-it) steps. A sample job description and CSV are in `backend/prisma/sample-data/`.
