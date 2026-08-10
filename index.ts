import Core, { type BaseData, type IModule } from "../../index.js";
import DiscordModule from "../ts-module-discord/index.js";
import Data from "./data.js";
import SlashCommandGet, { slashCommandGetName } from "./slash-commands/get.js";
import SlashCommandSet from "./slash-commands/set.js";

import * as Discord from "discord.js";

class DiscordReactionAutoRoleModule {
	readonly name = "discord-reaction-autorole" as const;
	readonly data: Data;
	readonly log = Core.log.makeFunctions(this.name);

	constructor() {
		this.data = new Data(this);

		DiscordModule
			.once("addAuthorizationFields", a => a
				.addPermissions(Discord.PermissionFlagsBits.ReadMessageHistory, Discord.PermissionFlagsBits.ManageRoles, Discord.PermissionFlagsBits.ViewChannel, Discord.PermissionFlagsBits.UseApplicationCommands)
				.addIntents(Discord.GatewayIntentBits.Guilds, Discord.GatewayIntentBits.GuildMessages, Discord.GatewayIntentBits.GuildMessageReactions)
				.addPartials(Discord.Partials.Message, Discord.Partials.Reaction, Discord.Partials.Channel))
			.once("afterClientCreation", () => this.afterDiscordClientCreation());
	}

	protected afterDiscordClientCreation() {
		DiscordModule.slashCommands.push(SlashCommandGet(), SlashCommandSet());

		DiscordModule.client
			.prependOnceListener("shard0Ready", async() => await this.data.initialize())
			.on("guildCreate", guild => this.onGuildCreate(guild))
			.on("guildUpdate", guild => this.onGuildUpdate(guild))
			.on("guildDelete", guild => this.onGuildDelete(guild))
			.on("channelUpdate", (oldChannel, newChannel) => this.onChannelUpdate(oldChannel, newChannel))
			.on("channelDelete", channel => this.onChannelDelete(channel))
			.on("messageDelete", message => this.onMessageDelete(message))
			.on("roleUpdate", (oldRole, newRole) => this.onRoleUpdate(oldRole, newRole))
			.on("roleDelete", role => this.onRoleDelete(role))
			.on("messageReactionAdd", (reaction, user, details) => this.onMessageReactionAdd(reaction, user, details))
			.on("messageReactionRemove", (reaction, user, details) => this.onMessageReactionRemove(reaction, user, details))
	}

	protected async onGuildCreate(guild: Discord.Guild) {
		if (!DiscordModule.slashCommands.isCommandInGuildAllowed(slashCommandGetName, guild.id)) return;

		this.data.getGuild(guild);
	}

	protected async onGuildUpdate(guild: Discord.Guild) {
		if (!DiscordModule.slashCommands.isCommandInGuildAllowed(slashCommandGetName, guild.id)) return;

		this.data.getGuild(guild).guild = guild;
	}

	protected async onGuildDelete(guild: Discord.Guild) {
		const guildData = this.data.guilds.get(guild.id);
		if (!guildData) return;

		if (guildData.isEnabled()) {
			guildData.disable();
			this.data.save();

			this.log.warn("Disabled guild data", {args: {
				guild: `${guild.name} (${guild.id})`,
				reason: "Discord bot was kicked/banned from guild"
			}});
		}
	}

	protected async onChannelUpdate(oldChannel: Discord.DMChannel | Discord.NonThreadGuildBasedChannel, newChannel: Discord.DMChannel | Discord.NonThreadGuildBasedChannel) {
		if (oldChannel.isDMBased() || newChannel.isDMBased()) return;
		if (DiscordModule.slashCommands.isCommandInGuildAllowed(slashCommandGetName, newChannel.guild.id)) return;

		let guildData = this.data.getGuild(newChannel.guild);
		if (guildData.isEnabled() && guildData.channel.id === newChannel.id) {
			if (newChannel.isTextBased())
				guildData.channel = newChannel;
			else {
				guildData = guildData.disable();
				guildData.channelID = undefined;
				this.data.save();

				this.log.warn("Disabled guild data", {args: {
					guild: `${newChannel.guild.name} (${newChannel.guild.id})`,
					channel: `#${newChannel.name} (${newChannel.id})`,
					reason: "Discord channel became not text based"
				}});
			}
		}
	}

	protected async onChannelDelete(channel: Discord.DMChannel | Discord.NonThreadGuildBasedChannel) {
		if (channel.isDMBased()) return;
		if (!DiscordModule.slashCommands.isCommandInGuildAllowed(slashCommandGetName, channel.guild.id)) return;

		let guildData = this.data.getGuild(channel.guild);
		if (guildData.isEnabled()) {
			if (guildData.channel.id === channel.id) {
				guildData = guildData.disable();
				guildData.channelID = undefined;
				this.data.save();

				this.log.warn("Disabled guild data", {args: {
					guild: `${channel.guild.name} (${channel.guild.id})`,
					channel: `#${channel.name} (${channel.id})`,
					reason: "Discord channel was deleted"
				}});
			}
		}
		else {
			if (guildData.channelID && guildData.channelID === channel.id) {
				guildData = guildData.disable();
				guildData.channelID = undefined;
				this.data.save();

				this.log.warn("Removed discord channel id from guild data", {args: {
					guild: `${channel.guild.name} (${channel.guild.id})`,
					channel: `#${channel.name} (${channel.id})`,
					reason: "Channel was deleted"
				}});
			}
		}
	}

	protected async onMessageDelete(message: Discord.OmitPartialGroupDMChannel<Discord.Message<boolean> | Discord.PartialMessage<boolean>>) {
		if (!message.inGuild()) return;
		if (!DiscordModule.slashCommands.isCommandInGuildAllowed(slashCommandGetName, message.guild.id)) return;

		let guildData = this.data.getGuild(message.guild);
		if (guildData.messageID === message.id) {
			guildData = guildData.disable();
			guildData.messageID = undefined;
			this.data.save();

			this.log.warn("Disabled guild data", {args: {
				guild: `${message.guild.name} (${message.guild.id})`,
				channel: `${message.channel.name} (${message.channel.id})`,
				messageID: message.id,
				messageContentFirst32Symbols: message.content?.substring(0, 32),
				reason: "Discord message was deleted"
			}});
		}
	}

	protected async onRoleUpdate(oldRole: Discord.Role, newRole: Discord.Role) {
		if (!DiscordModule.slashCommands.isCommandInGuildAllowed(slashCommandGetName, newRole.guild.id)) return;

		let guildData = this.data.getGuild(newRole.guild);
		if (guildData.isEnabled() && guildData.role.id === newRole.id) {
			guildData.role = newRole;
		}
	}

	protected async onRoleDelete(role: Discord.Role) {
		if (!DiscordModule.slashCommands.isCommandInGuildAllowed(slashCommandGetName, role.guild.id)) return;

		let guildData = this.data.getGuild(role.guild);
		if (guildData.isEnabled()) {
			if (guildData.role.id === role.id) {
				guildData = guildData.disable();
				guildData.roleID = undefined;
				this.data.save();

				this.log.warn("Disabled guild data", {args: {
					guild: `${role.guild.name} (${role.guild.id})`,
					role: `${role.name} (${role.id})`,
					reason: "Discord role was deleted"
				}});
			}
		}
		else {
			if (guildData.roleID === role.id) {
				guildData = guildData.disable();
				guildData.roleID = undefined;
				this.data.save();

				this.log.warn("Removed discord role id from guild data", {args: {
					guild: `${role.guild.name} (${role.guild.id})`,
					role: `${role.name} (${role.id})`,
					reason: "Discord role was deleted"
				}});
			}
		}
	}

	protected async onMessageReactionAdd(reaction: Discord.MessageReaction | Discord.PartialMessageReaction, user: Discord.User | Discord.PartialUser, details: Discord.MessageReactionEventDetails) {
		if (!reaction.message.inGuild()) return;
		if (!DiscordModule.slashCommands.isCommandInGuildAllowed(slashCommandGetName, reaction.message.guild.id)) return;

		const guildData = this.data.getGuild(reaction.message.guild);
		if (!guildData.isEnabled()) return;

		if (reaction.message.id !== guildData.messageID) return;

		let member;
		try {
			member = await reaction.message.guild.members.fetch(user.id);
		}
		catch(error) {
			this.log.error("Getting guild member failed", {error, args: {
				guild: `${reaction.message.guild.name} (${reaction.message.guild.id})`,
				userID: user.id
			}});
			return;
		}

		if (!member.roles.cache.has(guildData.role.id)) await member.roles.add(guildData.role);
		this.log.info("Guild member was verified", {args: {
			guild: `${reaction.message.guild.name} (${reaction.message.guild.id})`,
			user: `${user.username} (${user.id})`
		}});
	}

	protected async onMessageReactionRemove(reaction: Discord.MessageReaction | Discord.PartialMessageReaction, user: Discord.User | Discord.PartialUser, details: Discord.MessageReactionEventDetails) {
		if (!reaction.message.inGuild()) return;
		if (!DiscordModule.slashCommands.isCommandInGuildAllowed(slashCommandGetName, reaction.message.guild.id)) return;

		const guildData = this.data.getGuild(reaction.message.guild);
		if (!guildData.isEnabled()) return;

		if (reaction.message.id !== guildData.messageID) return;

		let member;
		try {
			member = await reaction.message.guild.members.fetch(user.id);
		}
		catch(error) {
			this.log.error("Getting guild member failed", {error, args: {
				guild: `${reaction.message.guild.name} (${reaction.message.guild.id})`,
				userID: user.id
			}});
			return;
		}

		if (member.roles.cache.has(guildData.role.id)) await member.roles.remove(guildData.role);
		this.log.info("Guild member was unverified", {args: {
			guild: `${reaction.message.guild.name} (${reaction.message.guild.id})`,
			user: `${user.username} (${user.id})`
		}});
	}
}
export default new DiscordReactionAutoRoleModule();