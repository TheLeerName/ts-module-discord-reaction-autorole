import Module from "../../index.js";
import type { GuildStateManager } from "../guild.js";

import type {
	Guild,
	GuildTextBasedChannel,
	Role,
} from "discord.js";

export interface GuildStateSave {
	disabled?: true;
	guildID: string;
	channelID?: string;
	messageID?: string;
	roleID?: string;
}

export class GuildState {
	enabled = false;

	guild?: Guild;
	guildID: string;

	channel?: GuildTextBasedChannel;
	channelID?: string;

	messageID?: string;

	roleID?: string;

	readonly manager: GuildStateManager;
	constructor(manager: GuildStateManager) {
		this.manager = manager;
	}

	isAvailable(): this is GuildStateAvailable {
		return this.enabled && this.guild != null && this.guild.available;
	}
	getGuildName() {
		return this.guild != null ? Module.discord.getGuildNameAndID(this.guild) : this.guildID;
	}
	getChannelName() {
		return this.channel != null ? Module.discord.getChannelNameAndID(this.channel) : this.channelID;
	}

	/** **NOTE:** this method may set {@link Module.data.needsSave} to `true` */
	async setChannelFromFetch() {
		if (this.channelID != null) {
			this.channel = (await Module.discord.fetchChannelWithNotFoundHandling(this.guild!, this.channelID) ?? undefined) as typeof this.channel;
			if (this.channel == null)
				this.unsetChannel();
		}
	}
	/** **NOTE:** this method will set {@link Module.data.needsSave} to `true` */
	unsetChannel(reason?: string) {
		Module.log.warn(`Guild was disabled`, {causedBy: reason ?? `"channel" was unset`, args: {
			guild: this.getGuildName(),
			channel: this.getChannelName(),
		}});
		this.enabled = false;
		delete this.channel;
		delete this.channelID;
		Module.data.needsSave = true;
	}
	/** **NOTE:** this method may set {@link Module.data.needsSave} to `true` */
	async setRoleFromFetch() {
		if (this.roleID != null) {
			const role = (await this.guild!.roles.fetch(this.roleID) ?? undefined);
			if (role == null)
				this.unsetRole();
		}
	}
	/** **NOTE:** this method will set {@link Module.data.needsSave} to `true` */
	unsetRole(reason?: string) {
		Module.log.warn(`Guild was disabled`, {causedBy: reason ?? `"roleID" was unset`, args: {
			guild: this.getGuildName(),
			roleID: this.roleID,
		}});
		this.enabled = false;
		delete this.roleID;
		Module.data.needsSave = true;
	}
	/** **NOTE:** this method may set {@link Module.data.needsSave} to `true` */
	async setMessageFromFetch() {
		if (this.channel != null && this.messageID != null) {
			const message = await Module.discord.fetchMessageWithNotFoundHandling(this.channel, this.messageID) ?? undefined;
			if (message == null)
				this.unsetMessage();
		}
	}
	/** **NOTE:** this method will set {@link Module.data.needsSave} to `true` */
	unsetMessage(reason?: string) {
		Module.log.warn(`Guild was disabled`, {causedBy: reason ?? `"messageID" was unset`, args: {
			guild: this.getGuildName(),
			roleID: this.roleID,
		}});
		this.enabled = false;
		delete this.messageID;
		Module.data.needsSave = true;
	}

	fromJSON(json: GuildStateSave) {
		this.enabled = !json.disabled;
		this.guildID = json.guildID;
		this.channelID = json.channelID;
		this.messageID = json.messageID;
		this.roleID = json.roleID;
	}
	toJSON(): GuildStateSave {
		return {
			disabled: this.enabled ? undefined : true,
			guildID: this.guild?.id ?? this.guildID,
			channelID: this.channel?.id ?? this.channelID,
			messageID: this.messageID,
			roleID: this.roleID,
		};
	}
}

export interface GuildStateAvailable extends GuildState {
	guild: Guild;
	
	channel: GuildTextBasedChannel;
	channelID: string;

	messageID: string;

	role: Role;
	roleID: string;
}