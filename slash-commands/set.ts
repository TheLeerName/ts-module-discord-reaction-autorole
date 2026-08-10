import Core from "../../../index.js";
import Module from "../index.js";
import { SlashCommand } from "../../ts-module-discord/index.js";

import * as Discord from "discord.js";

export default () => {
	const c = new SlashCommand()
	.setVersion(1)
	.setName("reaction-autorole-set")
	.setDescription(`Changes "${Module.name}" module parameters of this server`)
	.setDescriptionLocalization("ru", `Изменяет параметры модуля "${Module.name}" этого сервера`)
	.setChatInput(async(interaction) => {
		if (!interaction.inCachedGuild()) return;

		const start = Date.now();
		await interaction.deferReply();

		const args: any = {
			guild: `${interaction.guild.name} (${interaction.guild.id})`,
			user: `${interaction.user.username} (${interaction.user.id})`
		};
		try {
			let messageLink = interaction.options.getString("message-link");
			const role = interaction.options.getRole("role");

			const guildData = Module.data.getGuild(interaction.guild);

			if (messageLink) {
				const startLink = `https://discordapp.com/channels/${interaction.guild.id}/`;
				if (!messageLink.startsWith(startLink))
					throw new Error("Ссылка на сообщение неверна или сообщение находится не на этом сервере");
				messageLink = messageLink.substring(startLink.length);
				const channelID = messageLink.substring(0, messageLink.indexOf("/"));
				const channel = await interaction.client.channels.fetch(channelID);
				if (!channel)
					throw new Error("Указанный канал не найден");
				if (channel.isDMBased())
					throw new Error(`Указанный канал не является серверным`);
				if (channel.guild.id !== interaction.guild.id)
					throw new Error(`Указанный канал находится на другом сервере - ${channel.guild.name} (${channel.guild.id})`);
				if (!channel.isTextBased())
					throw new Error("Указанный канал не текстовый");

				messageLink = messageLink.substring(channelID.length + 1);
				let index = messageLink.indexOf("/");
				const messageID = messageLink.substring(0, index > -1 ? index : messageLink.length);
				await channel.messages.fetch(messageID);

				guildData.channel = channel;
				guildData.messageID = messageID;
			}
			else {
				guildData.channel = null;
				guildData.messageID = undefined;
			}

			if (role) {
				const me = await interaction.guild.members.fetchMe();
				if (interaction.guild.roles.comparePositions(me.roles.highest, role) < 0)
					throw new Error("Я не могу назначать эту роль, поставьте мою роль выше указанной роли в настройках сервера");

				guildData.role = role;
			}
			else
				guildData.role = null;

			if (guildData.channel && guildData.messageID && guildData.role)
				guildData.enabled = true;

			args.role = guildData.role ? `${guildData.role.name} (${guildData.role.id})` : guildData.roleID ?? guildData.role;
			args.channelID = guildData.channel ? `${guildData.channel.name} (${guildData.channel.id})` : guildData.channelID ?? guildData.channel;
			args.messageID = guildData.messageID;
			await interaction.editReply({embeds: [new Discord.EmbedBuilder()
				.setTitle(`:white_check_mark: Успешно!`)
				.setColor("#77b255")
				.setFooter({text: `Время обработки: ${Core.humanizeDuration(Date.now() - start)}`})
			]});
			Module.log.info(`Command ${c.name} success`, {args});
		}
		catch(error) {
			await interaction.editReply({embeds: [new Discord.EmbedBuilder()
				.setTitle(`:x: Ошибка!`)
				.setDescription(`\`\`\`\n${error.message}\n\`\`\``)
				.setColor("#dd2e44")
				.setFooter({text: `Время обработки: ${Core.humanizeDuration(Date.now() - start)}`})
			]});

			Module.log.error(`Command ${c.name} failed`, {error, args});
		}
		finally {
			Module.data.save();
		}
	});
	c.addStringOption(option => option
		.setName("message-link")
		.setDescription(`Link to message with reaction`)
		.setDescriptionLocalization("ru", `Ссылка на сообщение с реакцией`)
	).addRoleOption(option => option
		.setName("role")
		.setDescription("Gained role for reaction")
		.setDescriptionLocalization("ru", "Выдающаяся роль за реакцию")
	);
	return c;
};