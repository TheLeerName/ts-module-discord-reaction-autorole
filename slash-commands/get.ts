import Core from "../../../index.js";
import Module from "../index.js";
import DiscordModule, { SlashCommand } from "../../discord/index.js";

import * as Discord from "discord.js";

/** That command name uses for slash command allowing/banning system, if this will be banned on server, module will stop functioning on this server */
export const slashCommandGetName = "reaction-autorole-get";

export default () => {
	const c = new SlashCommand()
	.setVersion(1)
	.setName(slashCommandGetName)
	.setDescription(`Sends "${Module.name}" module parameters of this server`)
	.setDescriptionLocalization("ru", `Отправляет параметры модуля "${Module.name}" этого сервера`)
	.setChatInput(async(interaction) => {
		if (!interaction.inCachedGuild()) return;

		const start = Date.now();
		await interaction.deferReply();

		const args: any = {
			guild: DiscordModule.getGuildNameAndID(interaction.guild),
			member: DiscordModule.getGuildMemberNameAndID(interaction.member),
		};
		try {
			const state = Module.guilds.createAndGet(interaction.guild);

			args.roleID = state.roleID;
			args.channel = state.getChannelName();
			args.messageID = state.messageID;
			await interaction.editReply({embeds: [new Discord.EmbedBuilder()
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
				.setFooter({text: `Время обработки: ${Core.humanizeDuration(Date.now() - start)}`})
			]});
			Module.log.info(`Command ${c.name} success`, {args: {
				guild: `${interaction.guild.name} (${interaction.guild.id})`,
				user: `${interaction.user.username} (${interaction.user.id})`
			}});
		}
		catch(error) {
			await interaction.editReply({embeds: [new Discord.EmbedBuilder()
				.setTitle(`:x: Ошибка!`)
				.setDescription(`\`\`\`\n${error instanceof Error ? error.message : error}\n\`\`\``)
				.setColor("#dd2e44")
				.setFooter({text: `Время обработки: ${Core.humanizeDuration(Date.now() - start)}`})
			]});

			Module.log.error(`Command ${c.name} failed`, {error, args});
		}
	});
	return c;
};