# Leer's TS module: Discord Reaction Auto Role
Adds specified role to any user reacted to specified discord message, before starting using this on discord server, please check `/reaction-autorole-set` command description

## Features
1. Adds slash commands:

|Name|Type|Description|
|---|---|---|
|`/reaction-autorole-set`|Guild-only|Sets some required parameters for discord server:<br>- Link to message with reaction<br>- Gained role for reaction|
|`/reaction-autorole-get`|Guild-only|Sends these parameters above as discord embed message|

2. If command `/reaction-autorole-get` is banned on server by slash command allowing/banning system, module will stop functioning on this server

## How to install this module?
- Go to [parent repository](https://github.com/TheLeerName/ts-module-core) and read `README.md` file