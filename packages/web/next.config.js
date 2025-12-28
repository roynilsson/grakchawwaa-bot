/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  transpilePackages: ['@grakchawwaa/core'],
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Mark MikroORM and database drivers as external to avoid bundling issues
      config.externals = [
        ...config.externals,
        '@mikro-orm/core',
        '@mikro-orm/postgresql',
        '@mikro-orm/knex',
        'pg',
        'pg-query-stream',
        'oracledb',
        'better-sqlite3',
        'mysql2',
        'mariadb',
        'mongodb',
        'mssql',
      ]
    }
    return config
  },
}

module.exports = nextConfig
