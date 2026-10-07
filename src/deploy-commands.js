require("dotenv").config();

const {
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType
} = require("discord.js");

const commands = [
  new SlashCommandBuilder()
    .setName("help")
    .setDescription("Show the Exchange Bot usage guide."),

  new SlashCommandBuilder()
    .setName("exchange")
    .setDescription("Submit your server advertisement: text, links, and more."),

  new SlashCommandBuilder()
    .setName("setexchannel")
    .setDescription("Set the final exchange channel.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(option =>
      option
        .setName("channel")
        .setDescription("The final exchange channel")
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    ),

  new SlashCommandBuilder()
    .setName("exrequestchannel")
    .setDescription("Set the channel where exchange requests are reviewed.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(option =>
      option
        .setName("channel")
        .setDescription("The exchange request/review channel")
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    ),

  new SlashCommandBuilder()
    .setName("exrole")
    .setDescription("Set the role mentioned above new exchange requests.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addRoleOption(option =>
      option
        .setName("role")
        .setDescription("Role to mention")
        .setRequired(true)
    )
].map(c => c.toJSON());

async function main() {
  if (!process.env.DISCORD_TOKEN || !process.env.CLIENT_ID) {
    throw new Error("DISCORD_TOKEN and CLIENT_ID are required in .env");
  }

  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

  console.log("Registering GLOBAL slash commands...");
  await rest.put(
    Routes.applicationCommands(process.env.CLIENT_ID),
    { body: commands }
  );
  console.log("Global commands registered successfully.");
  console.log("Global Discord commands may take time to propagate to every server.");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
