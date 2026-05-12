FROM node:20

WORKDIR /app

# Install dependencies for Prisma
RUN apt-get update && apt-get install -y \
    openssl \
    ca-certificates \
    netcat-traditional \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy prisma schema and migrations
COPY prisma/schema.prisma ./prisma/
COPY prisma/migrations ./prisma/migrations/

# Generate Prisma client
RUN npx prisma generate

# Copy source code
COPY . .

# Build TypeScript
RUN npx tsc --build --force
RUN ls -la dist/ || (echo "Build failed" && exit 1)

# Copy and set permissions for entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Expose port
EXPOSE 3000

# Use entrypoint script
ENTRYPOINT ["/entrypoint.sh"]
