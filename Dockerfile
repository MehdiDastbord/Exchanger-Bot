FROM node:20-bookworm-slim

WORKDIR /app

# better-sqlite3 can use prebuilt binaries on Node 20. Keep build tooling
# available as a fallback if npm needs to compile the native module.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

CMD ["npm", "start"]
