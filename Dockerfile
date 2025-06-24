FROM oven/bun:1.1
WORKDIR /app
COPY . .
RUN bun install --production

ENV PORT=4000
EXPOSE 4000
CMD ["bun", "run", "start"]   # หรือ bun src/index.ts
