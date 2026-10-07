const { URL } = require("url");

function isValidImageUrl(value) {
  try {
    const u = new URL(value);
    if (!["http:", "https:"].includes(u.protocol)) return false;

    const lower = u.pathname.toLowerCase();
    const imageExt = /\.(png|jpe?g|gif|webp)$/i.test(lower);

    // Discord CDN URLs often have extensionless paths, so allow trusted Discord image hosts.
    const trusted = [
      "cdn.discordapp.com",
      "media.discordapp.net"
    ].includes(u.hostname);

    return imageExt || trusted;
  } catch {
    return false;
  }
}

function sanitizeMentions(text) {
  if (!text) return text;

  return text
    .replace(/@everyone/gi, "[everyone]")
    .replace(/@here/gi, "[here]")
    // User, role and channel mention syntax is made visibly harmless.
    .replace(/<@!?(\d+)>/g, "[@user:$1]")
    .replace(/<@&(\d+)>/g, "[@role:$1]")
    .replace(/<#(\d+)>/g, "[@channel:$1]");
}

function safeDisplayName(name) {
  return String(name || "Unknown").replace(/[@<>]/g, "");
}

module.exports = { isValidImageUrl, sanitizeMentions, safeDisplayName };