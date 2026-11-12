FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npx prisma generate && npm run build && npm prune --omit=dev

FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

RUN addgroup -S v3group && adduser -S v3user -G v3group

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/dist ./dist

USER v3user
EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 5000) + '/api/v1/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "dist/server.js"]

