import {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits,
  ChannelType,
  StringSelectMenuBuilder,
  ComponentType
} from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

interface BotConfig {
  ticketCategoryId?: string;
  staffRoleId?: string;
  logChannelId?: string;
  welcomeMessage: string;
  modalFields: ModalField[];
  embedColor: `#${string}`;
  embedTitle: string;
  embedDescription: string;
  buttonLabel: string;
  ticketNameFormat: string;
}

interface ModalField {
  id: string;
  label: string;
  placeholder: string;
  required: boolean;
  style: 'short' | 'paragraph';
  minLength?: number;
  maxLength?: number;
}

const config = new Map<string, BotConfig>();

// Configuration par défaut
const defaultConfig: BotConfig = {
  welcomeMessage: 'Merci de votre candidature ! Un membre du staff va vous répondre bientôt.',
  modalFields: [
    {
      id: 'age',
      label: 'Quel est votre âge ?',
      placeholder: 'Ex: 18',
      required: true,
      style: 'short',
      maxLength: 3
    },
    {
      id: 'experience',
      label: 'Avez-vous de l\'expérience ?',
      placeholder: 'Décrivez votre expérience...',
      required: true,
      style: 'paragraph',
      minLength: 20,
      maxLength: 1000
    },
    {
      id: 'motivation',
      label: 'Pourquoi nous rejoindre ?',
      placeholder: 'Expliquez votre motivation...',
      required: true,
      style: 'paragraph',
      minLength: 20,
      maxLength: 1000
    }
  ],
  embedColor: '#5865F2',
  embedTitle: '📋 Recrutement',
  embedDescription: 'Cliquez sur le bouton ci-dessous pour postuler !',
  buttonLabel: '✉️ Postuler',
  ticketNameFormat: 'candidature-{username}'
};

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages
  ]
});

client.once('ready', async () => {
  console.log(`✅ Bot connecté en tant que ${client.user?.tag}`);

  // Enregistrer les commandes slash
  const commands = [
    new SlashCommandBuilder()
      .setName('config')
      .setDescription('Affiche et modifie la configuration du bot')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    new SlashCommandBuilder()
      .setName('setup')
      .setDescription('Configure le panneau de recrutement')
      .addChannelOption(opt =>
        opt.setName('channel')
          .setDescription('Salon où envoyer le panneau')
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true)
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    new SlashCommandBuilder()
      .setName('close')
      .setDescription('Ferme le ticket de recrutement')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  ];

  await client.application?.commands.set(commands);
  console.log('✅ Commandes enregistrées');
});

client.on('interactionCreate', async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      const guildId = interaction.guildId!;
      
      if (!config.has(guildId)) {
        config.set(guildId, { ...defaultConfig });
      }

      if (interaction.commandName === 'config') {
        await handleConfigCommand(interaction);
      } else if (interaction.commandName === 'setup') {
        await handleSetupCommand(interaction);
      } else if (interaction.commandName === 'close') {
        await handleCloseCommand(interaction);
      }
    } else if (interaction.isButton()) {
      if (interaction.customId === 'open_recruitment') {
        await handleRecruitmentButton(interaction);
      } else if (interaction.customId === 'close_ticket') {
        await handleCloseTicket(interaction);
      } else if (interaction.customId.startsWith('config_')) {
        await handleConfigButtons(interaction);
      }
    } else if (interaction.isModalSubmit()) {
      if (interaction.customId === 'recruitment_modal') {
        await handleRecruitmentModal(interaction);
      } else if (interaction.customId.startsWith('edit_')) {
        await handleEditModal(interaction);
      }
    } else if (interaction.isStringSelectMenu()) {
      await handleSelectMenu(interaction);
    }
  } catch (err) {
    console.error('Erreur:', err);
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '❌ Une erreur est survenue.', ephemeral: true });
    }
  }
});

async function handleConfigCommand(interaction: any) {
  const guildConfig = config.get(interaction.guildId!)!;

  const embed = new EmbedBuilder()
    .setTitle('⚙️ Configuration du Bot de Recrutement')
    .setColor(guildConfig.embedColor as `#${string}`)
    .addFields(
      {
        name: '📁 Catégorie des tickets',
        value: guildConfig.ticketCategoryId 
          ? `<#${guildConfig.ticketCategoryId}>` 
          : '❌ Non défini',
        inline: true
      },
      {
        name: '👥 Rôle Staff',
        value: guildConfig.staffRoleId 
          ? `<@&${guildConfig.staffRoleId}>` 
          : '❌ Non défini',
        inline: true
      },
      {
        name: '📝 Salon de logs',
        value: guildConfig.logChannelId 
          ? `<#${guildConfig.logChannelId}>` 
          : '❌ Non défini',
        inline: true
      },
      {
        name: '🎨 Couleur de l\'embed',
        value: guildConfig.embedColor,
        inline: true
      },
      {
        name: '📋 Titre de l\'embed',
        value: guildConfig.embedTitle,
        inline: true
      },
      {
        name: '🏷️ Label du bouton',
        value: guildConfig.buttonLabel,
        inline: true
      },
      {
        name: '💬 Message de bienvenue',
        value: guildConfig.welcomeMessage.substring(0, 100) + (guildConfig.welcomeMessage.length > 100 ? '...' : ''),
        inline: false
      },
      {
        name: '📝 Questions du formulaire',
        value: guildConfig.modalFields.map((f, i) => `${i + 1}. ${f.label}`).join('\n') || 'Aucune',
        inline: false
      }
    )
    .setTimestamp();

  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('config_category')
      .setLabel('Catégorie')
      .setEmoji('📁')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('config_staff')
      .setLabel('Rôle Staff')
      .setEmoji('👥')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('config_logs')
      .setLabel('Logs')
      .setEmoji('📝')
      .setStyle(ButtonStyle.Primary)
  );

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('config_embed')
      .setLabel('Personnaliser Embed')
      .setEmoji('🎨')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('config_modal')
      .setLabel('Questions du formulaire')
      .setEmoji('📝')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('config_welcome')
      .setLabel('Message bienvenue')
      .setEmoji('💬')
      .setStyle(ButtonStyle.Secondary)
  );

  await interaction.reply({ embeds: [embed], components: [row1, row2], ephemeral: true });
}

async function handleConfigButtons(interaction: any) {
  const action = interaction.customId.replace('config_', '');
  
  if (action === 'category' || action === 'staff' || action === 'logs') {
    const modal = new ModalBuilder()
      .setCustomId(`edit_${action}`)
      .setTitle(`Configurer ${action === 'category' ? 'la catégorie' : action === 'staff' ? 'le rôle staff' : 'les logs'}`);

    const input = new TextInputBuilder()
      .setCustomId('value')
      .setLabel('ID')
      .setPlaceholder(`Entrez l'ID du ${action === 'category' ? 'channel' : action === 'staff' ? 'rôle' : 'salon'}`)
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
    await interaction.showModal(modal);
  } else if (action === 'embed') {
    const modal = new ModalBuilder()
      .setCustomId('edit_embed')
      .setTitle('Personnaliser l\'embed');

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('title')
          .setLabel('Titre')
          .setStyle(TextInputStyle.Short)
          .setValue(config.get(interaction.guildId!)!.embedTitle)
          .setRequired(true)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('description')
          .setLabel('Description')
          .setStyle(TextInputStyle.Paragraph)
          .setValue(config.get(interaction.guildId!)!.embedDescription)
          .setRequired(true)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('color')
          .setLabel('Couleur (hex)')
          .setPlaceholder('#5865F2')
          .setStyle(TextInputStyle.Short)
          .setValue(config.get(interaction.guildId!)!.embedColor)
          .setRequired(true)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('button')
          .setLabel('Label du bouton')
          .setStyle(TextInputStyle.Short)
          .setValue(config.get(interaction.guildId!)!.buttonLabel)
          .setRequired(true)
      )
    );

    await interaction.showModal(modal);
  } else if (action === 'modal') {
    await handleModalFieldsConfig(interaction);
  } else if (action === 'welcome') {
    const modal = new ModalBuilder()
      .setCustomId('edit_welcome')
      .setTitle('Message de bienvenue');

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('message')
          .setLabel('Message')
          .setStyle(TextInputStyle.Paragraph)
          .setValue(config.get(interaction.guildId!)!.welcomeMessage)
          .setRequired(true)
      )
    );

    await interaction.showModal(modal);
  }
}

async function handleModalFieldsConfig(interaction: any) {
  const guildConfig = config.get(interaction.guildId!)!;

  const options = guildConfig.modalFields.map((field, i) => ({
    label: `${i + 1}. ${field.label}`,
    description: `${field.style === 'short' ? 'Court' : 'Paragraphe'} - ${field.required ? 'Obligatoire' : 'Optionnel'}`,
    value: `field_${i}`
  }));

  // Limite Discord: 5 champs par modal maximum
  if (options.length >= 5) {
    options.push({
      label: '❌ Limite atteinte (5 champs max)',
      description: 'Supprimez un champ pour en ajouter un nouveau',
      value: 'limit_reached'
    });
  } else {
    options.push({
      label: '➕ Ajouter un champ',
      description: 'Créer une nouvelle question',
      value: 'add_field'
    });
  }

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('select_modal_field')
    .setPlaceholder('Sélectionnez un champ à modifier')
    .addOptions(options);

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  await interaction.reply({
    content: '📝 **Gestion des questions du formulaire**\n\n⚠️ Discord limite à **5 champs maximum** par modal.',
    components: [row],
    ephemeral: true
  });
}

async function handleSelectMenu(interaction: any) {
  const guildConfig = config.get(interaction.guildId!)!;

  if (interaction.customId === 'select_modal_field') {
    const value = interaction.values[0];

    if (value === 'limit_reached') {
      await interaction.reply({ content: '❌ Limite de 5 champs atteinte !', ephemeral: true });
      return;
    }

    if (value === 'add_field') {
      if (guildConfig.modalFields.length >= 5) {
        await interaction.reply({ content: '❌ Vous avez déjà 5 champs (limite Discord)', ephemeral: true });
        return;
      }

      const modal = new ModalBuilder()
        .setCustomId('add_modal_field')
        .setTitle('Ajouter une question');

      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('label')
            .setLabel('Question')
            .setPlaceholder('Ex: Quel est votre âge ?')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('placeholder')
            .setLabel('Placeholder')
            .setPlaceholder('Ex: 18')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('style')
            .setLabel('Type (short ou paragraph)')
            .setPlaceholder('short')
            .setStyle(TextInputStyle.Short)
            .setValue('short')
            .setRequired(true)
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('required')
            .setLabel('Obligatoire ? (oui ou non)')
            .setPlaceholder('oui')
            .setStyle(TextInputStyle.Short)
            .setValue('oui')
            .setRequired(true)
        )
      );

      await interaction.showModal(modal);
    } else     if (value.startsWith('field_')) {
      const index = parseInt(value.replace('field_', ''));
      const field = guildConfig.modalFields[index];

      if (!field) {
        await interaction.reply({ content: '❌ Champ introuvable !', ephemeral: true });
        return;
      }

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`edit_field_${index}`)
          .setLabel('Modifier')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`delete_field_${index}`)
          .setLabel('Supprimer')
          .setStyle(ButtonStyle.Danger)
      );

      await interaction.reply({
        content: `**Question sélectionnée:**\n\n**Label:** ${field.label}\n**Type:** ${field.style === 'short' ? 'Court' : 'Paragraphe'}\n**Obligatoire:** ${field.required ? 'Oui' : 'Non'}`,
        components: [row],
        ephemeral: true
      });
    }
  }
}

async function handleEditModal(interaction: any) {
  const guildConfig = config.get(interaction.guildId!)!;
  const action = interaction.customId.replace('edit_', '');

  if (action === 'category') {
    guildConfig.ticketCategoryId = interaction.fields.getTextInputValue('value');
    await interaction.reply({ content: '✅ Catégorie mise à jour !', ephemeral: true });
  } else if (action === 'staff') {
    guildConfig.staffRoleId = interaction.fields.getTextInputValue('value');
    await interaction.reply({ content: '✅ Rôle staff mis à jour !', ephemeral: true });
  } else if (action === 'logs') {
    guildConfig.logChannelId = interaction.fields.getTextInputValue('value');
    await interaction.reply({ content: '✅ Salon de logs mis à jour !', ephemeral: true });
  } else if (action === 'embed') {
    guildConfig.embedTitle = interaction.fields.getTextInputValue('title');
    guildConfig.embedDescription = interaction.fields.getTextInputValue('description');
    guildConfig.embedColor = interaction.fields.getTextInputValue('color');
    guildConfig.buttonLabel = interaction.fields.getTextInputValue('button');
    await interaction.reply({ content: '✅ Embed personnalisé !', ephemeral: true });
  } else if (action === 'welcome') {
    guildConfig.welcomeMessage = interaction.fields.getTextInputValue('message');
    await interaction.reply({ content: '✅ Message de bienvenue mis à jour !', ephemeral: true });
  }

  config.set(interaction.guildId!, guildConfig);
}

async function handleSetupCommand(interaction: any) {
  const channel = interaction.options.getChannel('channel');
  const guildConfig = config.get(interaction.guildId!)!;

  const embed = new EmbedBuilder()
    .setTitle(guildConfig.embedTitle)
    .setDescription(guildConfig.embedDescription)
    .setColor(guildConfig.embedColor as `#${string}`)
    .setTimestamp();

  const button = new ButtonBuilder()
    .setCustomId('open_recruitment')
    .setLabel(guildConfig.buttonLabel)
    .setStyle(ButtonStyle.Primary);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

  await channel.send({ embeds: [embed], components: [row] });
  await interaction.reply({ content: `✅ Panneau envoyé dans ${channel}`, ephemeral: true });
}

async function handleRecruitmentButton(interaction: any) {
  const guildConfig = config.get(interaction.guildId!)!;

  const modal = new ModalBuilder()
    .setCustomId('recruitment_modal')
    .setTitle('Formulaire de recrutement');

  // Limite Discord: 5 champs maximum
  const fields = guildConfig.modalFields.slice(0, 5);

  fields.forEach(field => {
    const input = new TextInputBuilder()
      .setCustomId(field.id)
      .setLabel(field.label)
      .setPlaceholder(field.placeholder || '')
      .setStyle(field.style === 'short' ? TextInputStyle.Short : TextInputStyle.Paragraph)
      .setRequired(field.required);

    if (field.minLength) input.setMinLength(field.minLength);
    if (field.maxLength) input.setMaxLength(field.maxLength);

    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
  });

  await interaction.showModal(modal);
}

async function handleRecruitmentModal(interaction: any) {
  const guildConfig = config.get(interaction.guildId!)!;

  if (!guildConfig.ticketCategoryId) {
    await interaction.reply({ content: '❌ La catégorie n\'est pas configurée !', ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const ticketName = guildConfig.ticketNameFormat.replace('{username}', interaction.user.username);

  const channel = await interaction.guild!.channels.create({
    name: ticketName,
    type: ChannelType.GuildText,
    parent: guildConfig.ticketCategoryId,
    permissionOverwrites: [
      {
        id: interaction.guild!.id,
        deny: [PermissionFlagsBits.ViewChannel]
      },
      {
        id: interaction.user.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
      },
      ...(guildConfig.staffRoleId ? [{
        id: guildConfig.staffRoleId,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
      }] : [])
    ]
  });

  const embed = new EmbedBuilder()
    .setTitle('📋 Nouvelle candidature')
    .setDescription(guildConfig.welcomeMessage)
    .setColor(guildConfig.embedColor as `#${string}`)
    .setThumbnail(interaction.user.displayAvatarURL())
    .addFields(
      { name: '👤 Candidat', value: `${interaction.user}`, inline: true },
      { name: '🆔 ID', value: interaction.user.id, inline: true }
    );

  guildConfig.modalFields.forEach(field => {
    const value = interaction.fields.getTextInputValue(field.id);
    if (value) {
      embed.addFields({ name: field.label, value: value, inline: false });
    }
  });

  const closeButton = new ButtonBuilder()
    .setCustomId('close_ticket')
    .setLabel('Fermer le ticket')
    .setEmoji('🔒')
    .setStyle(ButtonStyle.Danger);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(closeButton);

  await channel.send({ content: guildConfig.staffRoleId ? `<@&${guildConfig.staffRoleId}>` : '', embeds: [embed], components: [row] });
  
  await interaction.editReply({ content: `✅ Votre candidature a été créée : ${channel}` });
}

async function handleCloseTicket(interaction: any) {
  await interaction.reply({ content: '🔒 Fermeture du ticket dans 5 secondes...' });
  
  setTimeout(async () => {
    await interaction.channel?.delete();
  }, 5000);
}

async function handleCloseCommand(interaction: any) {
  if (!interaction.channel?.name.includes('candidature')) {
    await interaction.reply({ content: '❌ Cette commande ne peut être utilisée que dans un ticket !', ephemeral: true });
    return;
  }

  await handleCloseTicket(interaction);
}

// Gestion des boutons de modification de champs
client.on('interactionCreate', async interaction => {
  if (!interaction.isButton()) return;

  const guildConfig = config.get(interaction.guildId!)!;

  if (interaction.customId.startsWith('delete_field_')) {
    const index = parseInt(interaction.customId.replace('delete_field_', ''));
    guildConfig.modalFields.splice(index, 1);
    config.set(interaction.guildId!, guildConfig);
    await interaction.update({ content: '✅ Champ supprimé !', components: [] });
  }
});

// Gestion de l'ajout de champs
client.on('interactionCreate', async interaction => {
  if (!interaction.isModalSubmit()) return;
  
  if (interaction.customId === 'add_modal_field') {
    const guildConfig = config.get(interaction.guildId!)!;

    const label = interaction.fields.getTextInputValue('label');
    const placeholder = interaction.fields.getTextInputValue('placeholder') || '';
    const style = interaction.fields.getTextInputValue('style').toLowerCase() === 'paragraph' ? 'paragraph' : 'short';
    const required = interaction.fields.getTextInputValue('required').toLowerCase() === 'oui';

    const newField: ModalField = {
      id: `field_${Date.now()}`,
      label,
      placeholder,
      required,
      style: style as 'short' | 'paragraph'
    };

    guildConfig.modalFields.push(newField);
    config.set(interaction.guildId!, guildConfig);

    await interaction.reply({ content: '✅ Question ajoutée avec succès !', ephemeral: true });
  }
});

const TOKEN = process.env.DISCORD_TOKEN;

if (!TOKEN) {
  console.error('❌ DISCORD_TOKEN manquant dans le fichier .env');
  process.exit(1);
}

client.login(TOKEN);