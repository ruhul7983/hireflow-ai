FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Rewrites are fixed at build time, so the address has to be known here
ARG BACKEND_URL=http://backend:5000
ENV BACKEND_URL=$BACKEND_URL
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
