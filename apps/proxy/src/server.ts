import { type FastifyInstance } from 'fastify';
import { buildApp } from './app';
import { loadConfig } from './config';

/** Loads config, builds the app and listens on all interfaces. */
export async function start(
  env: Readonly<Record<string, string | undefined>> = process.env,
): Promise<FastifyInstance> {
  const config = loadConfig(env);
  const app = buildApp(config);
  await app.listen({ port: config.port, host: '0.0.0.0' });
  const address = app.server.address();
  app.log.info(
    {
      port: typeof address === 'object' && address ? address.port : config.port,
      provider: config.provider,
      attestMode: config.attestMode,
    },
    'proxy listening',
  );
  return app;
}

/* istanbul ignore next -- process entry point, exercised by proxy:dev and the Docker check */
if (require.main === module) {
  start().then(
    (app) => {
      // Cloud Run sends SIGTERM before stopping an instance.
      for (const signal of ['SIGTERM', 'SIGINT'] as const) {
        process.once(signal, () => void app.close().then(() => process.exit(0)));
      }
    },
    (error: unknown) => {
      console.error(error instanceof Error ? error.message : 'Failed to start proxy');
      process.exit(1);
    },
  );
}
