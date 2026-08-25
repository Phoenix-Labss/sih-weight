import { buildApp } from './app.js';
import { prisma } from './db/prisma.js';

const PORT = parseInt(process.env.PORT || '8000', 10);
const HOST = process.env.HOST || '0.0.0.0';

async function main() {
  const app = await buildApp({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
    },
  });

  try {
    await app.listen({ port: PORT, host: HOST });
    console.log(`[Legal Metrology API] Server listening at http://${HOST}:${PORT}`);
    console.log(`[Legal Metrology API] Public verification at http://${HOST}:${PORT}/v/:qrReference`);
  } catch (err) {
    console.error('[Legal Metrology API] Fatal startup error:', err);
    process.exit(1);
  }

  // Graceful shutdown handlers
  const gracefulShutdown = async (signal: string) => {
    console.log(`[Legal Metrology API] Received ${signal}, shutting down gracefully...`);
    try {
      await app.close();
      await prisma.$disconnect();
      console.log('[Legal Metrology API] Cleanup complete. Exiting process.');
      process.exit(0);
    } catch (err) {
      console.error('[Legal Metrology API] Error during shutdown:', err);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('[Legal Metrology API] Unhandled startup exception:', err);
  process.exit(1);
});
