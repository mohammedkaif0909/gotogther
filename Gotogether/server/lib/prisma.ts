import { PrismaClient } from '@prisma/client';

// Ensure .env is loaded in development or standalone execution
if (typeof process.loadEnvFile === 'function' && !process.env.DATABASE_URL) {
  try {
    process.loadEnvFile();
  } catch {
    // Ignore if .env is missing or already loaded
  }
}

function createPrismaClient() {
  const baseClient = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

  return baseClient.$extends({
    query: {
      async $allOperations({ args, query }) {
        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
          try {
            return await query(args);
          } catch (error: any) {
            attempts++;
            const isTransientError =
              error?.code === 'P1001' ||
              error?.code === 'P1002' ||
              error?.code === 'P1008' ||
              error?.code === 'P1017' ||
              (typeof error?.message === 'string' &&
                (error.message.includes("Can't reach database server") ||
                  error.message.includes('Connection terminated') ||
                  error.message.includes('Connection closed') ||
                  error.message.includes('forcibly closed') ||
                  error.message.includes('ConnectionReset') ||
                  error.message.includes('10054')));

            if (isTransientError && attempts < maxAttempts) {
              const backoffMs = attempts * 1000;
              console.warn(
                `[Prisma] Database connection dropped or waking up (attempt ${attempts}/${maxAttempts}). Retrying in ${backoffMs}ms...`
              );
              await new Promise((resolve) => setTimeout(resolve, backoffMs));
              continue;
            }
            throw error;
          }
        }
      },
    },
  });
}

type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>;

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: ExtendedPrismaClient | undefined;
}

export const prisma = globalThis.prismaGlobal ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.prismaGlobal = prisma;
}

