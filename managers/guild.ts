import Module from "../index.js";
import { GuildState, type GuildStateSave } from "./states/guild.js";

import type {
	Guild,
	DMChannel,
	NonThreadGuildBasedChannel,
	OmitPartialGroupDMChannel,
	Message,
	PartialMessage,
	Role,
	MessageReaction,
	PartialMessageReaction,
	User,
	PartialUser,
	MessageReactionEventDetails,
} from "discord.js";

export type GuildStateManagerSave = GuildStateSave[];

export class GuildStateManager extends Map<string, GuildState> {
	protected _availableGuildsCount = 0;

	/** NOTE: this method may set {@link Module.data.needsSave} to `true` */
	createAndGet(guild: Guild): GuildState {
		let state = this.get(guild.id);
		if (state == null) {
			state = new GuildState(this);
			state.guild = guild;
			state.guildID = guild.id;
			this.set(guild.id, state);
			Module.data.needsSave = true;
			Module.log.warn("Guild state was created without guildCreate event", {args: {
				guild: state.getGuildName(),
			}});
		}
		return state;
	}
	registerDiscordCallbacks() {
		Module.discord.client
			.on("guildCreate", g => this.onGuildCreate(g))
			.on("guildUpdate", (oldGuild, newGuild) => this.onGuildUpdate(oldGuild, newGuild))
			.on("guildDelete", g => this.onGuildDelete(g))
			.on("guildAvailable", g => this.onGuildAvailable(g))
			.on("channelUpdate", (oldChannel, newChannel) => this.onChannelUpdate(oldChannel, newChannel))
			.on("channelDelete", channel => this.onChannelDelete(channel))
			.on("messageDelete", message => this.onMessageDelete(message))
			.on("roleDelete", role => this.onRoleDelete(role))
			.on("messageReactionAdd", (reaction, user, details) => this.onMessageReactionAdd(reaction, user, details))
			.on("messageReactionRemove", (reaction, user, details) => this.onMessageReactionRemove(reaction, user, details));
	}

	fromJSON(array: GuildStateManagerSave) {
		for (const save of array) {
			const state = new GuildState(this);
			state.fromJSON(save);
			this.set(state.guildID, state);
		}
	}
	toJSON(): GuildStateManagerSave {
		return Array.from(this.values()).map(g => g.toJSON());
	}

	protected onGuildCreate(guild: Guild) {
		this._availableGuildsCount++;

		if (!Module.isAllowedInGuild(guild)) return;
		
		let state = this.get(guild.id);
		if (state != null) {
			state.guild = guild;
			state.guildID = guild.id;
		}
		else {
			state = new GuildState(this);
			state.guild = guild;
			state.guildID = guild.id;
			this.set(guild.id, state);
			Module.data.needsSave = true;
		}
		Module.data.save();
	}
	protected onGuildUpdate(oldGuild: Guild, newGuild: Guild) {
		if (!Module.isAllowedInGuild(newGuild)) return;

		const state = this.get(newGuild.id);
		if (state == null || !state.enabled) return;

		state.guild = newGuild;
	}
	protected onGuildDelete(guild: Guild) {
		this._availableGuildsCount--;

		if (!Module.isAllowedInGuild(guild)) return;

		const state = this.get(guild.id);
		if (state == null) return;

		state.guild = state.guild;
	}
	protected async onGuildAvailable(guild: Guild) {
		this._availableGuildsCount++;

		if (!Module.isAllowedInGuild(guild)) return;

		const state = this.get(guild.id);
		if (state == null || !state.enabled) return;

		state.guild = guild;
		state.guildID = guild.id;
		await state.setChannelFromFetch();
		await state.setRoleFromFetch();
		await state.setMessageFromFetch();
		if (this._availableGuildsCount >= Module.discord.client.guilds.cache.size)
			Module.data.save(true);
	}
	protected onGuildUnavailable(guild: Guild) {
		this._availableGuildsCount--;

		if (!Module.isAllowedInGuild(guild)) return;

		const state = this.get(guild.id);
		if (state == null) return;

		state.guild = guild;
	}
	protected onChannelUpdate(oldChannel: DMChannel | NonThreadGuildBasedChannel, newChannel: DMChannel | NonThreadGuildBasedChannel) {
		if (newChannel.isDMBased()) return;
		if (!Module.isAllowedInGuild(newChannel.guild)) return;

		const state = this.get(newChannel.guild.id);
		if (state == null || !state.enabled) return;

		if (state.channelID === newChannel.id)
			state.channel = newChannel as typeof state.channel;
	}
	protected onChannelDelete(channel: DMChannel | NonThreadGuildBasedChannel) {
		if (channel.isDMBased()) return;
		if (!Module.isAllowedInGuild(channel.guild)) return;

		const state = this.get(channel.guild.id);
		if (state == null || !state.enabled) return;

		if (state.channelID === channel.id)
			state.unsetChannel("Channel was deleted");

		Module.data.save();
	}
	protected onMessageDelete(message: OmitPartialGroupDMChannel<Message<boolean> | PartialMessage<boolean>>) {
		if (!message.inGuild()) return;
		if (!Module.isAllowedInGuild(message.guild)) return;

		const state = this.get(message.guild.id);
		if (state == null || !state.enabled) return;

		if (state.messageID === message.id)
			state.unsetMessage("Message was deleted");

		Module.data.save();
	}
	protected onRoleDelete(role: Role) {
		if (!Module.isAllowedInGuild(role.guild)) return;

		const state = this.get(role.guild.id);
		if (state == null || !state.enabled) return;

		if (state.roleID === role.id)
			state.unsetRole("Role was deleted");

		Module.data.save();
	}
	protected async onMessageReactionAdd(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser, details: MessageReactionEventDetails) {
		if (!reaction.message.inGuild()) return;
		if (!Module.isAllowedInGuild(reaction.message.guild)) return;

		const state = this.get(reaction.message.guild.id);
		if (state == null || !state.enabled) return;

		if (reaction.message.id !== state.messageID) return;

		const member = await Module.discord.fetchGuildMemberWithNotFoundHandling(reaction.message.guild, user.id);
		if (member == null) return;

		await member.roles.add(state.roleID!);
		Module.log.info("Added role to guild member", {args: {
			guild: Module.discord.getGuildNameAndID(reaction.message.guild),
			member: Module.discord.getGuildMemberNameAndID(member),
		}});
	}
	protected async onMessageReactionRemove(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser, details: MessageReactionEventDetails) {
		if (!reaction.message.inGuild()) return;
		if (!Module.isAllowedInGuild(reaction.message.guild)) return;

		const state = this.get(reaction.message.guild.id);
		if (state == null || !state.enabled) return;

		if (reaction.message.id !== state.messageID) return;

		const member = await Module.discord.fetchGuildMemberWithNotFoundHandling(reaction.message.guild, user.id);
		if (member == null) return;

		await member.roles.remove(state.roleID!);
		Module.log.info("Removed role from guild member", {args: {
			guild: Module.discord.getGuildNameAndID(reaction.message.guild),
			member: Module.discord.getGuildMemberNameAndID(member),
		}});
	}
}

export {
	GuildState,
	type GuildStateAvailable,
	type GuildStateSave,
} from "./states/guild.js";