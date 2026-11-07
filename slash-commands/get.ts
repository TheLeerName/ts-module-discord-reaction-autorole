import Core from "../../../index.js";
import Module from "../index.js";
import { SlashCommand } from "../../discord/index.js";

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
			guild: `${interaction.guild.name} (${interaction.guild.id})`,
			user: `${interaction.user.username} (${interaction.user.id})`
		};
		try {
			const guildData = Module.data.getGuild(interaction.guild);

			args.role = guildData.role ? `@${guildData.role.name} (${guildData.role.id})` : guildData.roleID ?? guildData.role;
			args.channelID = guildData.channel ? `${guildData.channel.name} (${guildData.channel.id})` : guildData.channelID ?? guildData.channel;
			args.messageID = guildData.messageID;
			await interaction.editReply({embeds: [new Discord.EmbedBuilder()
				.setTitle(`:notepad_spiral: Параметры модуля "${Module.name}" этого сервера`)
				.setFields(
					{
						name: "Выдающаяся роль за реакцию в сообщении",
						value: guildData.role ? `<@&${guildData.role.id}>` : `*не установлено*`
					},
					{
						name: "Cообщение с реакцией",
						value: guildData.channel && guildData.messageID ? `https://discord.com/channels/${interaction.guild.id}/${guildData.channel.id}/${guildData.messageID}` : `*не установлено*`
					}
				)
				.setColor("#77b255")
				.setFooter({text: `Время обработки: ${Core.humanizeDuration(Date.now() - start)}`})
			]});
			// TODO: [20:07:39.360] [ERROR] [/node:internal/process/task_queues:105:5] DiscordjsTypeError [InvalidType]: Command guild-verification-reaction-set guild-verification-reaction-set failed: Supplied role is not a Role nor a Snowflake.
		//guild: "undefined (590783997106454539)"
	// user: "theleername (456750857015263262)"
		//role: undefined
		//channelID: "『✅』верификация (1218838274903244820)"
		//messageID: "1220393087444975676"
		//code: "InvalidType"
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