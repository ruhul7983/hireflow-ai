FROM node:22-slim

RUN apt-get update -y && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npx prisma generate && npm run build

EXPOSE 5000

# Dev dependencies stay in the image, because migrations and the seed need them
CMD ["sh", "-c", "npx prisma migrate deploy && npm run seed && node dist/main"]
