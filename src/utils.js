function sanitizeMentions(text) {
  if (!text) return text;

  return text
    .replace(/@everyone/gi, "everyone")
    .replace(/@here/gi, "here")
    .replace(/<@!?(\d+)>/g, "[user]")
    .replace(/<@&(\d+)>/g, "[role]")
    .replace(/<#(\d+)>/g, "[channel]");
}

function safeDisplayName(name) {
  return String(name || "Unknown").replace(/[@<>]/g, "");
}

module.exports = { sanitizeMentions, safeDisplayName };