import { buildApp } from './app.js';
import { loadConfig } from './config.js';

const config = loadConfig();
const app = await buildApp({ logger: true, config });

async function shutdown(signal: string): Promise<void> {
  app.log.info({ signal }, 'arrêt');
  await app.close();
}

process.on('SIGINT', () => {
  void shutdown('SIGINT').then(() => process.exit(0));
});
process.on('SIGTERM', () => {
  void shutdown('SIGTERM').then(() => process.exit(0));
});

await app.listen({ port: config.port, host: '0.0.0.0' });
