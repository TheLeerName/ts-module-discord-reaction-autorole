import Module from "../index.js";
import { EmbedBuilder } from "discord.js";

export default () => Module.discord.slashCommands.make("reaction-autorole-set", c => {c
.setVersion(1)
.setDescription(`Changes "${Module.name}" module parameters of this server`)
.setDescriptionLocalization("ru", `Изменяет параметры модуля "${Module.name}" этого сервера`)
.setChatInput(async(interaction) => {
	if (!interaction.inCachedGuild()) return;

	const start = Date.now();
	await interaction.deferReply();

	const args: any = {
		guild: Module.discord.getGuildNameAndID(interaction.guild),
		member: Module.discord.getGuildMemberNameAndID(interaction.member),
	};
	try {
		let messageLink = interaction.options.getString("message-link");
		const role = interaction.options.getRole("role");

		const state = Module.guilds.createAndGet(interaction.guild);

		if (messageLink) {
			const m = messageLink.match(/https:\/\/.+?\..+?\/channels\/(.+?)\/(.+?)\/(.+)/);
			if (!m || m.length < 4)
				throw new Error("Ссылка на сообщение неверна");

			if (m[1] !== interaction.guild.id)
				throw new Error("Сообщение находится не на этом сервере");
			const channelID = m[2];
			const channel = await interaction.client.channels.fetch(channelID);
			if (!channel)
				throw new Error("Указанный канал не найден");
			if (channel.isDMBased())
				throw new Error(`Указанный канал не является серверным`);
			if (channel.guild.id !== interaction.guild.id)
				throw new Error(`Указанный канал находится на другом сервере - ${channel.guild.name} (${channel.guild.id})`);
			if (!channel.isTextBased())
				throw new Error("Указанный канал не текстовый");

			const messageID = m[3];
			await channel.messages.fetch(messageID);

			state.channel = channel;
			state.channelID = channel.id;
			state.messageID = messageID;
		}
		else {
			delete state.channel;
			delete state.channelID;
			delete state.messageID;
		}
		Module.data.needsSave = true;

		if (role) {
			const me = await interaction.guild.members.fetchMe();
			if (interaction.guild.roles.comparePositions(me.roles.highest, role) < 0)
				throw new Error("Я не могу назначать эту роль, поставьте мою роль выше указанной роли в настройках сервера");

			state.roleID = role.id;
		}
		else
			delete state.roleID;

		state.enabled = state.channel != null && state.messageID != null && state.roleID != null;

		args.roleID = state.roleID;
		args.channel = state.getChannelName();
		args.messageID = state.messageID;
		await interaction.editReply({embeds: [new EmbedBuilder()
			.setTitle(`:white_check_mark: Успешно!`)
			.setFields(
				{
					name: "Выдающаяся роль за реакцию в сообщении",
					value: state.roleID != null ? `<@&${state.roleID}>` : `*не установлено*`,
				},
				{
					name: "Cообщение с реакцией",
					value: state.channel != null && state.messageID != null ? `https://discord.com/channels/${interaction.guild.id}/${state.channel.id}/${state.messageID}` : `*не установлено*`,
				}
			)
			.setColor("#77b255")
			.setFooter({text: `Время обработки: ${Module.core.humanizeDuration(Date.now() - start)}`})
		]});
		Module.log.info(`Command ${c.name} success`, {args});
	}
	catch(error) {
		await interaction.editReply({embeds: [new EmbedBuilder()
			.setTitle(`:x: Ошибка!`)
			.setDescription(`\`\`\`\n${error instanceof Error ? error.message : error}\n\`\`\``)
			.setColor("#dd2e44")
			.setFooter({text: `Время обработки: ${Module.core.humanizeDuration(Date.now() - start)}`})
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
return c});