import Core from "../../index.js";
import Module from "./index.js";
import DiscordModule from "../discord/index.js";
import { BaseData } from "../../data.js";

import * as Discord from "discord.js";

class Guild {
	guild: Discord.Guild | null;
	enabled: boolean;

	channel: Discord.GuildTextBasedChannel | null;
	channelID: string | undefined;

	messageID: string | undefined;

	role: Discord.Role | null;
	roleID: string | undefined;

	constructor(guild: typeof this.guild, enabled: typeof this.enabled, channel: typeof this.channel | typeof this.channelID, messageID: typeof this.messageID, role: typeof this.role | typeof this.roleID) {
		this.guild = guild;
		this.enabled = enabled;

		if (channel) {
			if (typeof channel === "string")
				this.channelID = channel;
			else
				this.channel = channel;
		}

		this.messageID = messageID;

		if (role) {
			if (typeof role === "string")
				this.roleID = role;
			else
				this.role = role;
		}
	}

	isEnabled(): this is Guild.Enabled {
		return this.enabled;
	}
	enable(guild: Discord.Guild, channel: Discord.GuildTextBasedChannel, messageID: string, role: Discord.Role): Guild.Enabled {
		this.guild = guild;
		this.enabled = true;
		this.channel = channel;
		this.channelID = undefined;
		this.messageID = messageID;
		this.role = role;
		this.roleID = undefined;
		return this as any;
	}
	disable(): Guild.Disabled {
		this.guild = null;
		this.enabled = false;
		this.channelID = this.channel?.id;
		this.channel = null;
		this.roleID = this.role?.id;
		this.role = null;
		return this as any;
	}

	toJSON(): {
		enabled: boolean;
		channelID?: string;
		messageID?: string;
		roleID?: string;
	} {
		return {
			enabled: this.enabled,
			channelID: this.channel?.id ?? this.channelID,
			messageID: this.messageID,
			roleID: this.role?.id ?? this.roleID
		};
	}
}
export namespace Guild {
	export interface Enabled extends Guild {
		guild: Discord.Guild;
		enabled: true;

		channel: Discord.GuildTextBasedChannel;
		channelID: undefined;

		messageID: string;

		role: Discord.Role;
		roleID: undefined;
	}
	export interface Disabled extends Guild {
		guild: null;
		enabled: false;

		channel: null;
		channelID: string | undefined;

		messageID: string | undefined;

		role: null;
		roleID: string | undefined;
	}
}

export default class ModuleData extends BaseData {
	readonly guilds: Map<string, Guild> = new Map();

	protected moduleName: string;

	async initialize() {
		const json = this.getSavedFields();
		let needsSave = true;

		needsSave = !(await this.registerFieldMapAsync(json, "guilds", async(saved) => {
			for (const [guildID, rawGuildData] of Object.entries(saved)) {
				const guildData = new Guild(null, rawGuildData.enabled === true, typeof rawGuildData.channelID === "string" ? rawGuildData.channelID : undefined, typeof rawGuildData.messageID === "string" ? rawGuildData.messageID : undefined, typeof rawGuildData.roleID === "string" ? rawGuildData.roleID : undefined);
				this.guilds.set(guildID, guildData);

				if (!guildData.enabled) continue;

				try {
					guildData.guild = await DiscordModule.client.guilds.fetch(guildID);
				}
				catch(error) {
					Module.log.error("Guild data disabled, because getting guild failed", {error, args: {guildID}});
					continue;
				}

				if (guildData.channelID) {
					try {
						const c = await guildData.guild.channels.fetch(guildData.channelID);
						if (!c)
							throw new Error(`Channel not found`);
						if (c.isDMBased())
							throw new Error(`Channel is DM based`);
						if (c.guild.id != guildID)
							throw new Error(`Channel belongs to other server - ${c.guild.name} (${c.guild.id})`);
						if (!c.isTextBased())
							throw new Error(`Channel is not text based`);
						guildData.channel = c;
						guildData.channelID = undefined;
					}
					catch(error) {
						Module.log.error("Guild data disabled, because getting channel failed", {error, args: {
							guild: `${guildData.guild.name} (${guildData.guild.id})`,
							channelID: guildData.channelID
						}});
						guildData.channelID = undefined;
						guildData.enabled = false;
						continue;
					}
				}
				else {
					Module.log.error("Getting channel failed: ID is empty, guild data will be disabled", {args: {
						guild: `${guildData.guild.name} (${guildData.guild.id})`
					}});
					guildData.enabled = false;
					continue;
				}

				if (!guildData.messageID) {
					Module.log.error("Getting message failed: ID is empty, guild data will be disabled", {args: {
						guild: `${guildData.guild.name} (${guildData.guild.id})`
					}});
					guildData.enabled = false;
					continue;
				}

				if (guildData.roleID) {
					try {
						guildData.role = await guildData.guild.roles.fetch(guildData.roleID);
						if (!guildData.role)
							throw new Error("Role not found");
						guildData.roleID = undefined;
					}
					catch(error) {
						Module.log.error("Guild data will be disabled, getting role failed", {error, args: {
							guild: `${guildData.guild.name} (${guildData.guild.id})`,
							roleID: guildData.roleID
						}});
						guildData.roleID = undefined;
						guildData.enabled = false;
						continue;
					}
				}
				else {
					Module.log.error("Getting role failed: ID is empty, guild data will be disabled", {args: {
						guild: `${guildData.guild.name} (${guildData.guild.id})`
					}});
					guildData.enabled = false;
					continue;
				}

				guildData.enabled = true;
			}
		}, async() => {
			const guilds: Record<string, any> = {};
			this.guilds.forEach((v, k) => guilds[k] = v.toJSON());
			return guilds;
		}));

		if (needsSave)
			this.save();
		return this;
	}

	getGuild(guild: string | Discord.Guild) {
		let guildID = typeof guild === "string" ? guild : guild.id;
		let guildData = this.guilds.get(guildID);
		if (!guildData) {
			guildData = new Guild(null, false, undefined, undefined, undefined);
			this.guilds.set(guildID, guildData);
			this.save();

			if (typeof guild === "string")
				DiscordModule.client.guilds.fetch(guildID).then(guild => Module.log.info("Initialized guild data", {args: {guild: `${guild.name} (${guild.id})`}}));
			else
				Module.log.info("Initialized guild data", {args: {guild: `${guild.name} (${guild.id})`}});
		}
		return guildData;
	}
}