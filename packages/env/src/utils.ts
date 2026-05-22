/**
 * Parses a Redis URL into IORedis-compatible connection options.
 *
 * Supports:
 *   redis://host:port
 *   redis://:password@host:port
 *   rediss://host:port          (TLS)
 *   rediss://:password@host:port (TLS)
 *
 * Usage (IORedis):
 *   new Redis(env.REDIS_URL)
 *
 * Usage (BullMQ — needs plain options, not a URL string):
 *   new Queue("name", { connection: parseRedisUrl(env.REDIS_URL) })
 */
export function parseRedisUrl(url: string): {
  host: string;
  port: number;
  password?: string;
  tls?: object;
} {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: u.port ? parseInt(u.port, 10) : 6379,
    ...(u.password ? { password: decodeURIComponent(u.password) } : {}),
    ...(u.protocol === "rediss:" ? { tls: {} } : {}),
  };
}
