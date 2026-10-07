require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionsBitField
} = require("discord.js");

const {
  getConfig,
  createRequest,
  attachMessageId,
  getRequest,
  claimRequest
} = require("./db");

const { isValidImageUrl, sanitizeMentions, safeDisplayName } = require("./utils");

const EX_BOT_ROLE_NAME = "Ex Bot";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel]
});

function errorText(error) {
  console.error(error);
  return "Something went wrong. Please try again.";
}

function requestButtons(requestId, disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`exchange_accept:${requestId}`)
      .setLabel("Accept")
      .setStyle(ButtonStyle.Success)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId(`exchange_decline:${requestId}`)
      .setLabel("Decline")
      .setStyle(ButtonStyle.Danger)
      .setDisabled(disabled)
  );
}

async function ensureExBotRole(guild) {
  try {
    if (!guild?.members?.me) return null;
    const existing = guild.roles.cache.find(role => role.name === EX_BOT_ROLE_NAME);
    const role = existing || await guild.roles.create({
      name: EX_BOT_ROLE_NAME,
      color: 0x5865F2,
      mentionable: false,
      reason: "Exchange Bot system role"
    });
    if (!guild.members.me.roles.cache.has(role.id)) {
      await guild.members.me.roles.add(role, "Assign Exchange Bot system role");
    }
    return role;
  } catch (err) {
    console.warn(`Could not create/assign '${EX_BOT_ROLE_NAME}' in ${guild?.name || guild?.id}:`, err.message);
    return null;
  }
}

async function ensureAllGuildRoles() {
  for (const guild of client.guilds.cache.values()) await ensureExBotRole(guild);
}

async function requireAdmin(interaction) {
  if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
    await interaction.reply({
      content: "❌ You need the Administrator permission to use this command.",
      ephemeral: true
    });
    return false;
  }
  return true;
}

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  console.log(`Serving ${client.guilds.cache.size} guild(s).`);
  await ensureAllGuildRoles();
  console.log(`'${EX_BOT_ROLE_NAME}' role check completed.`);
});

client.on("guildCreate", async guild => {
  await ensureExBotRole(guild);
});

client.on("interactionCreate", async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === "exchange") {
        const config = getConfig(interaction.guildId);

        if (!config?.request_channel_id || !config?.exchange_role_id) {
          return interaction.reply({
            content: "❌ Exchange is not configured yet. An administrator must set the request channel and exchange role first.",
            ephemeral: true
          });
        }

        const modal = new ModalBuilder()
          .setCustomId("exchange_modal")
          .setTitle("Server Exchange");

        const banner = new TextInputBuilder()
          .setCustomId("banner_url")
          .setLabel("Server banner URL")
          .setPlaceholder("https://cdn.discordapp.com/...")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(1000);

        modal.addComponents(
          new ActionRowBuilder().addComponents(banner)
        );

        return interaction.showModal(modal);
      }

      if (interaction.commandName === "help") {
        return interaction.reply({
          content:
            "**🤖 Exchange Bot — راهنمای استفاده**\n\n" +
            "**دستورات عمومی:**\n" +
            "`/exchange` — ارسال درخواست اکسچنج و بنر برای بررسی.\n" +
            "`/help` — نمایش همین راهنما.\n\n" +
            "**دستورات مدیریت (Administrator):**\n" +
            "`/exrequestchannel` — تعیین چنل بررسی درخواست‌ها.\n" +
            "`/setexchannel` — تعیین چنل نهایی اکسچنج.\n" +
            "`/exrole` — تعیین رول بررسی‌کننده‌ها.\n\n" +
            "**روند اکسچنج:**\n" +
            "1. با `/exchange` لینک مستقیم بنر را ارسال کنید.\n" +
            "2. درخواست در چنل بررسی نمایش داده می‌شود.\n" +
            "3. با **Accept** درخواست منتشر می‌شود و با **Decline** رد می‌شود.\n" +
            "4. بعد از تصمیم، پیام درخواست از چنل بررسی حذف می‌شود.\n" +
            "5. نتیجه همراه با تاریخ، زمان، سرور و شخص بررسی‌کننده برای درخواست‌دهنده DM می‌شود.\n\n" +
            "**Bot ID:** `itskingpubgyt`\n" +
            "**Developer:** Mehdi",
          ephemeral: true
        });
      }

      if (interaction.commandName === "setexchannel") {
        if (!(await requireAdmin(interaction))) return;
        const channel = interaction.options.getChannel("channel", true);

        if (!channel.isTextBased()) {
          return interaction.reply({ content: "❌ Please select a text-based channel.", ephemeral: true });
        }

        require("./db").setConfig(interaction.guildId, "exchange_channel_id", channel.id);
        return interaction.reply({
          content: `✅ Final exchange channel set to <#${channel.id}>.`,
          ephemeral: true
        });
      }

      if (interaction.commandName === "exrequestchannel") {
        if (!(await requireAdmin(interaction))) return;
        const channel = interaction.options.getChannel("channel", true);

        if (!channel.isTextBased()) {
          return interaction.reply({ content: "❌ Please select a text-based channel.", ephemeral: true });
        }

        require("./db").setConfig(interaction.guildId, "request_channel_id", channel.id);
        return interaction.reply({
          content: `✅ Exchange request channel set to <#${channel.id}>.`,
          ephemeral: true
        });
      }

      if (interaction.commandName === "exrole") {
        if (!(await requireAdmin(interaction))) return;
        const role = interaction.options.getRole("role", true);

        require("./db").setConfig(interaction.guildId, "exchange_role_id", role.id);
        return interaction.reply({
          content: `✅ Exchange request mention role set to <@&${role.id}>.`,
          ephemeral: true
        });
      }
    }

    if (interaction.isModalSubmit() && interaction.customId === "exchange_modal") {
      const bannerUrl = interaction.fields.getTextInputValue("banner_url").trim();

      if (!isValidImageUrl(bannerUrl)) {
        return interaction.reply({
          content: "❌ That does not look like a valid image/banner URL. Use a direct PNG, JPG, GIF, or WebP URL (Discord CDN URLs are supported).",
          ephemeral: true
        });
      }

      const config = getConfig(interaction.guildId);
      if (!config?.request_channel_id || !config?.exchange_role_id) {
        return interaction.reply({
          content: "❌ Exchange is not configured correctly by an administrator.",
          ephemeral: true
        });
      }

      const requestChannel = await interaction.guild.channels.fetch(config.request_channel_id).catch(() => null);
      if (!requestChannel?.isTextBased()) {
        return interaction.reply({
          content: "❌ The configured request channel cannot be accessed.",
          ephemeral: true
        });
      }

      const requestId = `${interaction.guildId}-${interaction.id}`;
      createRequest({
        requestId,
        guildId: interaction.guildId,
        requesterId: interaction.user.id,
        requesterUsername: interaction.user.username,
        requesterTag: interaction.user.tag,
        bannerUrl
      });

      const requesterTag = safeDisplayName(interaction.user.tag);
      const requesterUsername = safeDisplayName(interaction.user.username);
      const reviewHeader =
        `<@&${config.exchange_role_id}>  •  **${requesterUsername}**  •  \`${requesterTag}\`  •  ID: \`${interaction.user.id}\``;

      const embed = new EmbedBuilder()
        .setTitle("New Exchange Request")
        .setDescription(`**Request ID:** \`${requestId}\``)
        .setImage(bannerUrl)
        .setFooter({ text: "Review this request using the buttons below." })
        .setTimestamp();

      const sent = await requestChannel.send({
        content: reviewHeader,
        embeds: [embed],
        components: [requestButtons(requestId)],
        allowedMentions: {
          roles: [config.exchange_role_id],
          users: [],
          repliedUser: false
        }
      });

      attachMessageId(requestId, sent.id);

      return interaction.reply({
        content: "✅ Your exchange request has been submitted for review.",
        ephemeral: true
      });
    }

    if (interaction.isButton()) {
      const [action, requestId] = interaction.customId.split(":");

      if (!["exchange_accept", "exchange_decline"].includes(action)) return;

      const request = getRequest(requestId);
      if (!request || request.status !== "pending") {
        return interaction.reply({
          content: "⚠️ This exchange request has already been processed or no longer exists.",
          ephemeral: true
        });
      }

      const config = getConfig(request.guild_id);

      // Validate the final exchange channel before claiming an approval.
      // This prevents a request from becoming permanently locked if configuration is broken.
      let finalChannel = null;
      if (action === "exchange_accept") {
        if (!config?.exchange_channel_id) {
          return interaction.reply({
            content: "❌ The final exchange channel is not configured. An administrator must use /setexchannel.",
            ephemeral: true
          });
        }

        finalChannel = await interaction.guild.channels.fetch(config.exchange_channel_id).catch(() => null);
        if (!finalChannel?.isTextBased()) {
          return interaction.reply({
            content: "❌ The configured final exchange channel cannot be accessed.",
            ephemeral: true
          });
        }
      }

      // The buttons are intentionally public: every member can Accept or Decline.
      const status = action === "exchange_accept" ? "accepted" : "declined";
      const claimed = claimRequest(requestId, status, interaction.user.id);

      if (!claimed) {
        return interaction.reply({
          content: "⚠️ Someone else already processed this request.",
          ephemeral: true
        });
      }

      const processedAt = Date.now();
      const processedUnix = Math.floor(processedAt / 1000);
      const guildName = interaction.guild?.name || "Unknown Server";
      const reviewerTag = safeDisplayName(interaction.user.tag);
      const reviewerId = interaction.user.id;
      const requestChannel = interaction.channel;
      const requestChannelName = requestChannel?.name ? `#${requestChannel.name}` : "Unknown channel";
      const resultText = status === "accepted" ? "قبول شد ✅" : "رد شد ❌";

      if (action === "exchange_accept") {
        // Sanitize message text and all Discord mention syntax. The image itself is not modified:
        // if @everyone is literally printed inside the image pixels, Discord cannot remove it
        // without image editing. The published Discord message itself can never ping anyone.
        const safeUrl = sanitizeMentions(request.banner_url);

        // Final exchange channel: publish only the original submitted banner/form content.
        // No requester ID, tag, reviewer, or anti-scam metadata is added here.
        const publishEmbed = new EmbedBuilder()
          .setImage(request.banner_url);

        await finalChannel.send({
          embeds: [publishEmbed],
          allowedMentions: {
            parse: [],
            users: [],
            roles: [],
            repliedUser: false
          }
        });
      }

      // Respond to the button interaction first, then remove the request message.
      await interaction.deferUpdate();
      await interaction.message.delete().catch(() => {});

      // Notify the requester by DM. DM failure must never undo the decision.
      const requester = await client.users.fetch(request.requester_id).catch(() => null);
      if (requester) {
        const dmEmbed = new EmbedBuilder()
          .setTitle(status === "accepted" ? "✅ درخواست اکسچنج قبول شد" : "❌ درخواست اکسچنج رد شد")
          .setColor(status === "accepted" ? 0x57F287 : 0xED4245)
          .setDescription(
            `درخواست بنر شما در سرور **${guildName}** ${resultText}.\n\n` +
            `**اطلاعات درخواست**\n` +
            `• Request ID: \`${request.request_id}\`\n` +
            `• Server: **${guildName}**\n` +
            `• Server ID: \`${request.guild_id}\`\n` +
            `• Requester ID: \`${request.requester_id}\`\n` +
            `• Review Channel: ${requestChannelName}\n` +
            `• Banner: ${sanitizeMentions(request.banner_url)}\n\n` +
            `**اطلاعات بررسی**\n` +
            `• نتیجه: **${resultText}**\n` +
            `• بررسی‌کننده: **${reviewerTag}**\n` +
            `• Reviewer ID: \`${reviewerId}\`\n` +
            `• تاریخ و زمان: <t:${processedUnix}:F>\n` +
            `• زمان نسبی: <t:${processedUnix}:R>` +
            (status === "accepted"
              ? `\n• Final Exchange Channel: <#${config.exchange_channel_id}>`
              : "")
          )
          .setFooter({ text: "Exchange Bot • itskingpubgyt - Mehdi" })
          .setTimestamp(processedAt);

        await requester.send({ embeds: [dmEmbed] }).catch(err => {
          console.warn(`Could not DM requester ${request.requester_id}:`, err.message);
        });
      }

      return;
    }

  } catch (err) {
    console.error(err);

    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: errorText(err),
        ephemeral: true
      }).catch(() => {});
    } else if (interaction.isRepliable() && interaction.deferred) {
      await interaction.editReply({ content: errorText(err) }).catch(() => {});
    }
  }
});

client.login(process.env.DISCORD_TOKEN);