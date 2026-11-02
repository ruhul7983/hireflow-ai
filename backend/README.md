# HireFlow AI: backend

The API, AI agent and background workers for HireFlow AI, built with NestJS, Prisma, BullMQ and LangChain.

The full documentation is in the [main README](../README.md), including the architecture, the LangChain agent, human in the loop, background jobs, the API reference and trade-offs.

## Run it

You need Node 22, Postgres and Redis running, or use `docker compose up --build` from the repository root to run everything.

```bash
cp .env.example .env
npm install
npx prisma migrate deploy
npx prisma generate
npm run seed
npm run start:dev
```

The API listens on port 5000. Then start the [client](../client/README.md).

Sample data is in `prisma/sample-data/`.
