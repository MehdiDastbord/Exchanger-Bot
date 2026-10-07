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

function splitMessage(text, maxLength = 2000) {
  const chunks = [];
  let remaining = text;

  while (remaining.length > maxLength) {
    let splitAt = remaining.lastIndexOf("\n", maxLength - 1);
    if (splitAt <= 0) splitAt = remaining.lastIndexOf(" ", maxLength - 1);
    if (splitAt <= 0) splitAt = maxLength;
    else splitAt += 1;

    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt);
  }

  if (remaining.length) chunks.push(remaining);
  return chunks;
}

module.exports = { sanitizeMentions, safeDisplayName, splitMessage };