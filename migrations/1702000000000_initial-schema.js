/* eslint-disable camelcase */

/**
 * Initial database schema
 * Creates the core tables for the bot
 */

exports.shorthands = undefined

exports.up = (pgm) => {
  // Players table - stores Discord user to ally code mappings
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

  // Ticket violations table - stores guild ticket violation history
  pgm.createTable('ticketViolations', {
    guild_id: { type: 'text', notNull: true },
    date: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
    ticket_counts: { type: 'jsonb', notNull: true },
  })

  // Composite primary key for ticketViolations
  pgm.addConstraint('ticketViolations', 'ticketViolations_pkey', {
    primaryKey: ['guild_id', 'date'],
  })

  // Guild message channels table - stores channel registrations per guild
  pgm.createTable('guildMessageChannels', {
    guild_id: { type: 'text', primaryKey: true },
    ticket_collection_channel_id: { type: 'text' },
    next_ticket_collection_refresh_time: { type: 'text' },
    ticket_reminder_channel_id: { type: 'text' },
    anniversary_channel_id: { type: 'text' },
  })

  // Function to automatically delete old ticket violations
  pgm.createFunction(
    'delete_old_ticket_violations',
    [],
    {
      returns: 'trigger',
      language: 'plpgsql',
      replace: true,
    },
    `
    BEGIN
      DELETE FROM "ticketViolations"
      WHERE date < NOW() - INTERVAL '3 months';
      RETURN NULL;
    END;
    `,
  )

  // Trigger to call the cleanup function after inserts
  pgm.createTrigger('ticketViolations', 'cleanup_old_violations', {
    when: 'AFTER',
    operation: 'INSERT',
    function: 'delete_old_ticket_violations',
  })

  // Initial cleanup of any old records
  pgm.sql(`
    DELETE FROM "ticketViolations"
    WHERE date < NOW() - INTERVAL '3 months';
  `)
}

exports.down = (pgm) => {
  // Drop in reverse order
  pgm.dropTrigger('ticketViolations', 'cleanup_old_violations', {
    ifExists: true,
  })
  pgm.dropFunction('delete_old_ticket_violations', [], { ifExists: true })
  pgm.dropTable('guildMessageChannels', { ifExists: true })
  pgm.dropTable('ticketViolations', { ifExists: true })
  pgm.dropTable('players', { ifExists: true })
}
