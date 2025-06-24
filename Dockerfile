FROM oven/bun:1

WORKDIR /app

COPY package.json bun.lockb ./
RUN bun install --production

COPY . .

ARG PORT
ENV PORT=${PORT:-4000}
EXPOSE ${PORT}

CMD bun run src/index.ts