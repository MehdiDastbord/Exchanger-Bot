const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");

const dataDir = path.join(__dirname, "..", "data");
fs.mkdirSync(dataDir, { recursive: true });

const databasePath = process.env.DATABASE_PATH || path.join(dataDir, "exchange.sqlite");
fs.mkdirSync(path.dirname(databasePath), { recursive: true });
const db = new Database(databasePath);
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS guild_config (
  guild_id TEXT PRIMARY KEY,
  exchange_channel_id TEXT,
  request_channel_id TEXT,
  exchange_role_id TEXT
);

CREATE TABLE IF NOT EXISTS requests (
  request_id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL,
  requester_id TEXT NOT NULL,
  requester_username TEXT,
  requester_tag TEXT,
  banner_url TEXT NOT NULL,
  message_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL,
  processed_at INTEGER,
  processed_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_requests_message ON requests(message_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);

`);

// Migrate older SQLite databases without requiring any external database service.
const requestColumns = db.prepare("PRAGMA table_info(requests)").all().map(c => c.name);
if (!requestColumns.includes("requester_username")) db.exec("ALTER TABLE requests ADD COLUMN requester_username TEXT");
if (!requestColumns.includes("requester_tag")) db.exec("ALTER TABLE requests ADD COLUMN requester_tag TEXT");

function getConfig(guildId) {
  return db.prepare("SELECT * FROM guild_config WHERE guild_id = ?").get(guildId);
}

function setConfig(guildId, field, value) {
  const allowed = new Set([
    "exchange_channel_id",
    "request_channel_id",
    "exchange_role_id"
  ]);
  if (!allowed.has(field)) throw new Error("Invalid configuration field");

  db.prepare(`
    INSERT INTO guild_config (guild_id, ${field})
    VALUES (?, ?)
    ON CONFLICT(guild_id) DO UPDATE SET ${field}=excluded.${field}
  `).run(guildId, value);
}

function createRequest(request) {
  db.prepare(`
    INSERT INTO requests
      (request_id, guild_id, requester_id, requester_username, requester_tag, banner_url, message_id, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, NULL, 'pending', ?)
  `).run(
    request.requestId,
    request.guildId,
    request.requesterId,
    request.requesterUsername || null,
    request.requesterTag || null,
    request.bannerUrl,
    Date.now()
  );
}

function attachMessageId(requestId, messageId) {
  db.prepare("UPDATE requests SET message_id = ? WHERE request_id = ?")
    .run(messageId, requestId);
}

function getRequest(requestId) {
  return db.prepare("SELECT * FROM requests WHERE request_id = ?").get(requestId);
}

function getRequestByMessage(messageId) {
  return db.prepare("SELECT * FROM requests WHERE message_id = ?").get(messageId);
}

function claimRequest(requestId, status, processedBy) {
  const result = db.prepare(`
    UPDATE requests
    SET status = ?, processed_at = ?, processed_by = ?
    WHERE request_id = ? AND status = 'pending'
  `).run(status, Date.now(), processedBy, requestId);

  return result.changes === 1;
}

function releaseAcceptedRequest(requestId, processedBy) {
  const result = db.prepare(`
    UPDATE requests
    SET status = 'pending', processed_at = NULL, processed_by = NULL
    WHERE request_id = ? AND status = 'accepted' AND processed_by = ?
  `).run(requestId, processedBy);

  return result.changes === 1;
}

module.exports = {
  db,
  getConfig,
  setConfig,
  createRequest,
  attachMessageId,
  getRequest,
  getRequestByMessage,
  claimRequest,
  releaseAcceptedRequest
};