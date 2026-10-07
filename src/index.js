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
  deleteRequest,
  getRequest,
  claimRequest,
  releaseAcceptedRequest
} = require("./db");

const { sanitizeMentions, safeDisplayName } = require("./utils");

const EX_BOT_ROLE_NAME = "Ex Bot";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel]
});

function errorText() {
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

client.once("clientReady", async () => {
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

        // Discord paragraph fields support up to 4000 characters.
        const advertisementText = new TextInputBuilder()
          .setCustomId("advertisement_text")
          .setLabel("Advertisement text (links optional)")
          .setPlaceholder("Write a description, invite, website, social links, and any other details...")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(4000);

        modal.addComponents(
          new ActionRowBuilder().addComponents(advertisementText)
        );

        return interaction.showModal(modal);
      }

      if (interaction.commandName === "help") {
        return interaction.reply({
          content:
            "**🤖 Exchange Bot — راهنمای استفاده**\n\n" +
            "**دستورات عمومی:**\n" +
            "`/exchange` — ارسال متن بنر/تبلیغ سرور و لینک‌های آن برای بررسی.\n" +
            "`/help` — نمایش همین راهنما.\n\n" +
            "**دستورات مدیریت (Administrator):**\n" +
            "`/exrequestchannel` — تعیین چنل بررسی درخواست‌ها.\n" +
            "`/setexchannel` — تعیین چنل نهایی اکسچنج.\n" +
            "`/exrole` — تعیین رول بررسی‌کننده‌ها.\n\n" +
            "**روند اکسچنج:**\n" +
            "1. با `/exchange` متن تبلیغ سرور و لینک‌های خود را وارد کنید.\n" +
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
      const advertisementText = interaction.fields.getTextInputValue("advertisement_text").trim();

      if (!advertisementText) {
        return interaction.reply({
          content: "❌ Please enter your advertisement text. Links are optional.",
          ephemeral: true
        });
      }

      await interaction.deferReply({ ephemeral: true });

      const config = getConfig(interaction.guildId);
      if (!config?.request_channel_id || !config?.exchange_role_id) {
        return interaction.editReply({
          content: "❌ Exchange is not configured correctly by an administrator.",
        });
      }

      const requestChannel = await interaction.guild.channels.fetch(config.request_channel_id).catch(() => null);
      if (!requestChannel?.isTextBased()) {
        return interaction.editReply({
          content: "❌ The configured request channel cannot be accessed.",
        });
      }

      const botMember = interaction.guild.members.me;
      const botPermissions = botMember && requestChannel.permissionsFor(botMember);
      if (!botPermissions?.has([
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.EmbedLinks
      ])) {
        return interaction.editReply({
          content: "❌ I need View Channel, Send Messages, and Embed Links permissions in the configured request channel."
        });
      }

      const requestId = `${interaction.guildId}-${interaction.id}`;
      const requesterTag = safeDisplayName(interaction.user.tag);
      const requesterUsername = safeDisplayName(interaction.user.username);
      const reviewHeader =
        `<@&${config.exchange_role_id}>  •  **${requesterUsername}**  •  \`${requesterTag}\`  •  ID: \`${interaction.user.id}\``;

      const detailsEmbed = new EmbedBuilder()
        .setTitle("New Exchange Request")
        .setDescription(`**Request ID:** \`${requestId}\``)
        .setFooter({ text: "Review this request using the buttons below." })
        .setTimestamp();

      const advertisementEmbed = new EmbedBuilder()
        .setDescription(sanitizeMentions(advertisementText));

      let sentMessage;
      try {
        createRequest({
          requestId,
          guildId: interaction.guildId,
          requesterId: interaction.user.id,
          requesterUsername: interaction.user.username,
          requesterTag: interaction.user.tag,
          bannerUrl: advertisementText
        });

        sentMessage = await requestChannel.send({
          content: reviewHeader,
          embeds: [detailsEmbed, advertisementEmbed],
          components: [requestButtons(requestId)],
          allowedMentions: {
            roles: [config.exchange_role_id],
            users: [],
            repliedUser: false
          }
        });

        attachMessageId(requestId, sentMessage.id);
      } catch (error) {
        console.error(`Could not submit exchange request ${requestId}:`, error);
        if (sentMessage) {
          await sentMessage.delete().catch(deleteError => {
            console.error(`Could not remove incomplete review message ${sentMessage.id}:`, deleteError);
          });
        }
        try {
          deleteRequest(requestId);
        } catch (deleteError) {
          console.error(`Could not remove incomplete exchange request ${requestId}:`, deleteError);
        }
        return interaction.editReply({
          content: "❌ I couldn't post your request. Please ask an administrator to check the bot's permissions and try again."
        });
      }

      return interaction.editReply({
        content: "✅ Your exchange request has been submitted for review."
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
        // Sanitize message text and Discord mention syntax before publication.
        const safeContent = sanitizeMentions(request.banner_url);

        // Final exchange channel: publish only the submitted advertisement.
        // Links remain clickable while Discord mentions are made harmless.
        const publishEmbed = new EmbedBuilder()
          .setDescription(safeContent);

        try {
          await finalChannel.send({
            embeds: [publishEmbed],
            allowedMentions: {
              parse: [],
              users: [],
              roles: [],
              repliedUser: false
            }
          });
        } catch (error) {
          try {
            if (!releaseAcceptedRequest(requestId, interaction.user.id)) {
              console.error(`Could not release failed exchange request ${requestId} for retry.`);
            }
          } catch (releaseError) {
            console.error(`Could not release failed exchange request ${requestId} for retry:`, releaseError);
          }
          throw error;
        }
      }

      // Respond to the button interaction first, then remove the request message.
      await interaction.deferUpdate();
      await interaction.message.delete().catch(error => {
        console.warn(`Could not delete processed exchange request ${requestId}:`, error.message);
      });

      // Notify the requester by DM. DM failure must never undo the decision.
      const requester = await client.users.fetch(request.requester_id).catch(error => {
        console.warn(`Could not fetch requester ${request.requester_id} for notification:`, error.message);
        return null;
      });
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
            `• Review Channel: ${requestChannelName}\n\n` +
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

        const advertisementEmbed = new EmbedBuilder()
          .setTitle("Submitted Advertisement")
          .setDescription(sanitizeMentions(request.banner_url));

        await requester.send({ embeds: [dmEmbed, advertisementEmbed] }).catch(err => {
          console.warn(`Could not DM requester ${request.requester_id}:`, err.message);
        });
      }

      return;
    }

  } catch (err) {
    console.error("Interaction failed:", err);

    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: errorText(),
        ephemeral: true
      }).catch(() => {});
    } else if (interaction.isRepliable() && interaction.deferred) {
      await interaction.editReply({ content: errorText() }).catch(replyError => {
        console.error("Could not report interaction failure to user:", replyError);
      });
    }
  }
});

client.login(process.env.DISCORD_TOKEN);