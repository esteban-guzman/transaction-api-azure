export default () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3000),
  database: {
    url: process.env.DATABASE_URL,
  },
  provider: {
    baseUrl: process.env.PROVIDER_BASE_URL,
    timeoutMs: Number(process.env.PROVIDER_TIMEOUT_MS ?? 3000),
  },
});
