FROM node:24.19.0-bookworm-slim
WORKDIR /app
RUN corepack enable
COPY . .
RUN corepack pnpm install --frozen-lockfile && corepack pnpm exec tsc -p apps/api/tsconfig.json
EXPOSE 3000
CMD ["node", "apps/api/dist/main.js"]
