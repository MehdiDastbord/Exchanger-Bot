# Discord Exchange Bot v1.4.0

- Global slash commands for multi-server use, plus instant guild registration for servers the bot is already in.
- Unlimited exchange submissions per user.
- Per-guild review/final channels and custom mention role.
- Automatically creates/uses the bot role `Ex Bot` in every guild.
- Review message shows custom exchange role + requester username/tag/ID and the submitted multi-line advertisement.
- Final exchange channel receives only the submitted multi-line advertisement, including clickable links.
- Atomic Accept/Decline locking.
- Review message deleted after decision.
- Detailed requester DM on Accept/Decline.
- `/help` is ephemeral.
- SQLite storage; use a persistent Railway Volume at `/data`.

## Variables
```env
DISCORD_TOKEN=YOUR_BOT_TOKEN
CLIENT_ID=YOUR_APPLICATION_CLIENT_ID
DATABASE_PATH=/data/exchange.sqlite
```
`GUILD_ID` is not used.

## Permissions
The bot needs View Channel, Send Messages, Embed Links, Read Message History, and Manage Roles. Its highest role must be able to manage the `Ex Bot` role.

## Commands
`/exchange` — Submit a multi-line server advertisement (text + links).
`/help`
`/exrequestchannel channel:<channel>`
`/setexchannel channel:<channel>`
`/exrole role:<role>`

The three configuration commands require Administrator.

## Railway
Mount a persistent Volume at `/data`, set `DATABASE_PATH=/data/exchange.sqlite`, then run `npm install`, `npm run deploy`, and `npm start`.
