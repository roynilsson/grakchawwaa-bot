/**
 * Standard configuration keys used in the guild_configs table
 */
export const GUILD_CONFIG_KEYS = {
  TICKET_COLLECTION_CHANNEL_ID: "ticket_collection_channel_id",
  NEXT_TICKET_COLLECTION_REFRESH_TIME: "next_ticket_collection_refresh_time",
  TICKET_REMINDER_CHANNEL_ID: "ticket_reminder_channel_id",
  ANNIVERSARY_CHANNEL_ID: "anniversary_channel_id",
} as const

export type GuildConfigKey = (typeof GUILD_CONFIG_KEYS)[keyof typeof GUILD_CONFIG_KEYS]
