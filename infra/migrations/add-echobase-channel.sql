-- Add echobase_channel_id column to guildMessageChannels table
ALTER TABLE guildMessageChannels
ADD COLUMN IF NOT EXISTS echobase_channel_id TEXT;
