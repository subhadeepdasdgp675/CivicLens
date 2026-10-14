# ----------- BUILDER STAGE -----------
FROM node:20 AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npx prisma generate
RUN npm run build


# ----------- PRODUCTION STAGE -----------
FROM node:20-slim

WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# 🔥 regenerate Prisma for correct runtime
RUN npx prisma generate

EXPOSE 5001

CMD ["node", "dist/server.js"]