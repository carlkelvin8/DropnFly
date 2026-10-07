import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const connectionString = process.env.SUPABASE_URL;
  if (!connectionString) {
    throw new Error(
      "SUPABASE_URL is not set. Set it in your environment variables."
    );
  }
  // Without timeouts a query sent on a connection the Supabase pooler already closed waits forever,
  // so a request hangs until the platform kills it (the client then sees "Load failed"). Fail fast
  // and let the next request get a fresh connection instead.
  const adapter = new PrismaPg({
    connectionString,
    connectionTimeoutMillis: 10_000,
    query_timeout: 12_000,
    idleTimeoutMillis: 10_000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
  });
  // A query that timed out on a dead pooled connection succeeds right away on a fresh one. Retry
  // read-only operations once; writes are never retried so nothing can be applied twice.
  return new PrismaClient({ adapter }).$extends({
    query: {
      async $allOperations({ operation, args, query }) {
        try {
          return await query(args);
        } catch (error) {
          const readOnly = READ_OPERATIONS.has(operation) || (operation === "$queryRaw" && isSelectSql(args));
          if (!readOnly || !isTimeout(error)) throw error;
          return query(args);
        }
      },
    },
  }) as unknown as PrismaClient;
}

const READ_OPERATIONS = new Set([
  "findUnique", "findUniqueOrThrow", "findFirst", "findFirstOrThrow", "findMany",
  "count", "aggregate", "groupBy",
]);

/** Raw queries are retried only when they are plain SELECTs (rate-limit uses $queryRaw for an upsert). */
function isSelectSql(args: unknown) {
  const first = Array.isArray(args) ? args[0] : args;
  const strings = (first as { strings?: readonly string[] } | null)?.strings;
  const text = Array.isArray(strings) ? strings.join("?") : typeof first === "string" ? first : "";
  return /^\s*(SELECT|WITH)\b/i.test(text) && !/\b(INSERT|UPDATE|DELETE)\b/i.test(text);
}

function isTimeout(error: unknown) {
  return /timeout|timed out|ETIMEDOUT|ECONNRESET|Connection terminated/i.test(String((error as Error)?.message ?? error));
}

function getPrisma() {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}

export const prisma = new Proxy({} as PrismaClient, {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get(_target, prop: any) {
    return getPrisma()[prop as keyof PrismaClient];
  },
});
