FROM node:20-slim

WORKDIR /app

# Install OpenSSL and ca-certificates for Prisma
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies and generate Prisma client
RUN npm ci && npx prisma generate

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Copy and set permissions for entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Expose port
EXPOSE 3000

# Use entrypoint script
ENTRYPOINT ["/entrypoint.sh"]
