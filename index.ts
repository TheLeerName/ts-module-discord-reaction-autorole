import Core from "../../index.js";
import DiscordModule from "../discord/index.js";
import Data from "./data.js";
import { GuildStateManager } from "./managers/guild.js";
import SlashCommandGet from "./slash-commands/get.js";
import SlashCommandSet from "./slash-commands/set.js";

import * as Discord from "discord.js";

export class DiscordReactionAutoRoleModule {
	readonly name = "discord-reaction-autorole" as const;
	readonly data: Data;
	readonly log = Core.log.makeFunctions(this.name);

	isDisabled = () => false;

	readonly guilds: GuildStateManager = new GuildStateManager();

	constructor() {
		if (this.isDisabled()) return;
		this.data = new Data(this).initialize();

		DiscordModule
			.once("addAuthorizationFields", a => a
				.addPermissions(Discord.PermissionFlagsBits.ReadMessageHistory, Discord.PermissionFlagsBits.ManageRoles, Discord.PermissionFlagsBits.ViewChannel)
				.addIntents(Discord.GatewayIntentBits.Guilds, Discord.GatewayIntentBits.GuildMessages, Discord.GatewayIntentBits.GuildMessageReactions)
				.addPartials(Discord.Partials.Message, Discord.Partials.Reaction, Discord.Partials.Channel, Discord.Partials.GuildMember))
			.once("afterClientCreation", () => this.afterDiscordClientCreation());
	}

	protected afterDiscordClientCreation() {
		DiscordModule.slashCommands.push(SlashCommandGet(), SlashCommandSet());
		this.guilds.registerDiscordCallbacks();
	}
}
export default new DiscordReactionAutoRoleModule();

export {
	GuildStateManager,
	type GuildStateManagerSave,
	GuildState,
	type GuildStateAvailable,
	type GuildStateSave,
} from "./managers/guild.js";

export { slashCommandGetName } from "./slash-commands/get.js";