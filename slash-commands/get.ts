import Module from "../index.js";
import { EmbedBuilder } from "discord.js";

/** That command name used for slash command allowing/banning system, if this will be banned on server, module will stop functioning on this server */
export default () => Module.discord.slashCommands.make("reaction-autorole-get", c => {c
.setVersion(1)
.setDescription(`Sends "${Module.name}" module parameters of this server`)
.setDescriptionLocalization("ru", `Отправляет параметры модуля "${Module.name}" этого сервера`)
.setChatInput(async(interaction) => {
	if (!interaction.inCachedGuild()) return;

	const start = Date.now();
	await interaction.deferReply();

	const args: any = {
		guild: Module.discord.getGuildNameAndID(interaction.guild),
		member: Module.discord.getGuildMemberNameAndID(interaction.member),
	};
	try {
		const state = Module.guilds.createAndGet(interaction.guild);

		args.roleID = state.roleID ?? `*не установлено*`;
		args.channel = state.getChannelName() ?? `*не установлено*`;
		args.messageID = state.messageID ?? `*не установлено*`;
		await interaction.editReply({embeds: [new EmbedBuilder()
			.setTitle(`:notepad_spiral: Параметры модуля "${Module.name}" этого сервера`)
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
		Module.log.info(`Command ${c.name} success`, {args: {
			guild: `${interaction.guild.name} (${interaction.guild.id})`,
			user: `${interaction.user.username} (${interaction.user.id})`
		}});
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
});
return c});