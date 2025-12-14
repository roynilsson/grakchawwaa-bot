/* eslint-disable camelcase */

/**
 * Database restructuring migration
 *
 * Changes:
 * 1. Create guilds table to store SWGOH guild information
 * 2. Replace guildMessageChannels with flexible guildConfig key-value table
 * 3. Restructure players table:
 *    - Change PK from discord_id to ally_code
 *    - Replace alt_ally_codes array with alt number column
 *    - Add player_id and player_name from Comlink
 *    - Add guild_id foreign key
 */

exports.shorthands = undefined

exports.up = (pgm) => {
  // 1. Rename tables to snake_case convention
  pgm.renameTable('ticketViolations', 'ticket_violations')
  pgm.renameTable('guildMessageChannels', 'guild_message_channels')

  // 2. Create guilds table
  pgm.createTable('guilds', {
    guild_id: { type: 'text', primaryKey: true },
    guild_name: { type: 'text' },
    discord_server_id: { type: 'text' },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
    updated_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  })

  // 3. Extract and insert unique guild IDs from existing tables
  pgm.sql(`
    INSERT INTO guilds (guild_id)
    SELECT DISTINCT guild_id FROM "guild_message_channels"
    UNION
    SELECT DISTINCT guild_id FROM "ticket_violations"
    ON CONFLICT (guild_id) DO NOTHING;
  `)

  // 4. Create guild_configs table (key-value structure)
  pgm.createTable('guild_configs', {
    guild_id: { type: 'text', notNull: true },
    name: { type: 'text', notNull: true },
    value: { type: 'text', notNull: true },
  })

  // Composite primary key
  pgm.addConstraint('guild_configs', 'guild_configs_pkey', {
    primaryKey: ['guild_id', 'name'],
  })

  // Foreign key to guilds table
  pgm.addConstraint('guild_configs', 'guild_configs_guild_id_fkey', {
    foreignKeys: {
      columns: 'guild_id',
      references: 'guilds(guild_id)',
      onDelete: 'CASCADE',
    },
  })

  // 5. Migrate data from guild_message_channels to guild_configs
  pgm.sql(`
    INSERT INTO "guild_configs" (guild_id, name, value)
    SELECT guild_id, 'ticket_collection_channel_id', ticket_collection_channel_id
    FROM "guild_message_channels"
    WHERE ticket_collection_channel_id IS NOT NULL
    UNION ALL
    SELECT guild_id, 'next_ticket_collection_refresh_time', next_ticket_collection_refresh_time
    FROM "guild_message_channels"
    WHERE next_ticket_collection_refresh_time IS NOT NULL
    UNION ALL
    SELECT guild_id, 'ticket_reminder_channel_id', ticket_reminder_channel_id
    FROM "guild_message_channels"
    WHERE ticket_reminder_channel_id IS NOT NULL
    UNION ALL
    SELECT guild_id, 'anniversary_channel_id', anniversary_channel_id
    FROM "guild_message_channels"
    WHERE anniversary_channel_id IS NOT NULL;
  `)

  // 6. Drop old guild_message_channels table
  pgm.dropTable('guild_message_channels')

  // 7. Add foreign key to ticket_violations
  pgm.addConstraint('ticket_violations', 'ticket_violations_guild_id_fkey', {
    foreignKeys: {
      columns: 'guild_id',
      references: 'guilds(guild_id)',
      onDelete: 'CASCADE',
    },
  })

  // 8. Restructure players table
  // First, rename old table to preserve data temporarily
  pgm.renameTable('players', 'players_old')

  // Create new players table with updated structure
  pgm.createTable('players', {
    ally_code: { type: 'char(9)', primaryKey: true },
    discord_id: { type: 'text', notNull: true },
    alt: { type: 'integer', notNull: true, default: 1 },
    player_id: { type: 'text' },
    player_name: { type: 'text' },
    guild_id: { type: 'text' },
    registered_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  })

  // Add unique constraint for discord_id + alt combination
  pgm.addConstraint('players', 'players_discord_id_alt_unique', {
    unique: ['discord_id', 'alt'],
  })

  // Add unique constraint for player_id
  pgm.addConstraint('players', 'players_player_id_unique', {
    unique: 'player_id',
  })

  // Add foreign key to guilds
  pgm.addConstraint('players', 'players_guild_id_fkey', {
    foreignKeys: {
      columns: 'guild_id',
      references: 'guilds(guild_id)',
      onDelete: 'SET NULL',
    },
  })

  // 9. Migrate existing player data
  // Primary ally codes (alt = 1)
  pgm.sql(`
    INSERT INTO players (ally_code, discord_id, alt, registered_at)
    SELECT ally_code, discord_id, 1, registered_at
    FROM players_old;
  `)

  // Alt ally codes (alt = 2, 3, 4, ...)
  // This uses unnest with ordinality to get the index
  pgm.sql(`
    INSERT INTO players (ally_code, discord_id, alt, registered_at)
    SELECT
      alt_code,
      discord_id,
      row_number + 1 as alt,
      registered_at
    FROM players_old,
    LATERAL unnest(alt_ally_codes) WITH ORDINALITY AS t(alt_code, row_number)
    WHERE alt_ally_codes IS NOT NULL;
  `)

  // 10. Drop old players table
  pgm.dropTable('players_old')
}

exports.down = (pgm) => {
  // Reverse migration - restore original structure

  // 1. Recreate old players table structure
  pgm.renameTable('players', 'players_new')

  pgm.createTable('players', {
    discord_id: { type: 'text', primaryKey: true },
    ally_code: { type: 'char(9)', notNull: true },
    alt_ally_codes: { type: 'char(9)[]' },
    registered_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  })

  // Migrate data back - group by discord_id and aggregate alts
  pgm.sql(`
    INSERT INTO players (discord_id, ally_code, alt_ally_codes, registered_at)
    SELECT
      discord_id,
      MIN(CASE WHEN alt = 1 THEN ally_code END) as ally_code,
      ARRAY_AGG(ally_code) FILTER (WHERE alt > 1) as alt_ally_codes,
      MIN(registered_at) as registered_at
    FROM players_new
    GROUP BY discord_id;
  `)

  pgm.dropTable('players_new')

  // 2. Recreate guild_message_channels table (will be renamed to guildMessageChannels later)
  pgm.createTable('guild_message_channels', {
    guild_id: { type: 'text', primaryKey: true },
    ticket_collection_channel_id: { type: 'text' },
    next_ticket_collection_refresh_time: { type: 'text' },
    ticket_reminder_channel_id: { type: 'text' },
    anniversary_channel_id: { type: 'text' },
  })

  // Migrate data back from guild_configs
  pgm.sql(`
    INSERT INTO "guild_message_channels" (guild_id)
    SELECT DISTINCT guild_id FROM "guild_configs";
  `)

  pgm.sql(`
    UPDATE "guild_message_channels" gmc
    SET ticket_collection_channel_id = gc.value
    FROM "guild_configs" gc
    WHERE gmc.guild_id = gc.guild_id AND gc.name = 'ticket_collection_channel_id';
  `)

  pgm.sql(`
    UPDATE "guild_message_channels" gmc
    SET next_ticket_collection_refresh_time = gc.value
    FROM "guild_configs" gc
    WHERE gmc.guild_id = gc.guild_id AND gc.name = 'next_ticket_collection_refresh_time';
  `)

  pgm.sql(`
    UPDATE "guild_message_channels" gmc
    SET ticket_reminder_channel_id = gc.value
    FROM "guild_configs" gc
    WHERE gmc.guild_id = gc.guild_id AND gc.name = 'ticket_reminder_channel_id';
  `)

  pgm.sql(`
    UPDATE "guild_message_channels" gmc
    SET anniversary_channel_id = gc.value
    FROM "guild_configs" gc
    WHERE gmc.guild_id = gc.guild_id AND gc.name = 'anniversary_channel_id';
  `)

  // 3. Remove foreign key from ticket_violations
  pgm.dropConstraint('ticket_violations', 'ticket_violations_guild_id_fkey', {
    ifExists: true,
  })

  // 4. Drop new tables
  pgm.dropTable('guild_configs', { ifExists: true })
  pgm.dropTable('guilds', { ifExists: true })

  // 5. Rename tables back to original camelCase names
  pgm.renameTable('guild_message_channels', 'guildMessageChannels')
  pgm.renameTable('ticket_violations', 'ticketViolations')
}
