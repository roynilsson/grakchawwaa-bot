module.exports = {
  // Migration files location
  dir: 'migrations',

  // Database connection
  // Uses environment variables for configuration
  databaseUrl:
    process.env.NODE_ENV === 'production'
      ? process.env.PG_DATABASE_URL
      : `postgresql://${process.env.PGUSER}:${process.env.PGPASSWORD}@${process.env.PGHOST}:${process.env.PGPORT}/${process.env.PGDATABASE}`,

  // Migration table name (tracks which migrations have been run)
  migrationsTable: 'pgmigrations',

  // Schema to use
  schema: 'public',

  // Direction of migration
  direction: 'up',

  // Number of migrations to run (0 = all)
  count: Infinity,

  // Create schema if it doesn't exist
  createSchema: true,

  // Create migration table if it doesn't exist
  createMigrationsSchema: true,

  // Disable transaction wrapping (set to true if you want transactions)
  noLock: false,

  // Log SQL statements
  verbose: true,
}
