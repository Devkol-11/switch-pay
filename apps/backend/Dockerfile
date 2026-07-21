# Use lightweight Node or Bun Alpine image
FROM oven/bun:alpine AS base
WORKDIR /app

# Copy dependency files first (Leverages Docker caching)
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy source code and Prisma schema
COPY . .
RUN npx prisma generate

EXPOSE 3000
CMD ["bun", "run", "start"]