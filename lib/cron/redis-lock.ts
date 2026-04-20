import setConnectionRedis from '@/utils/otp/connectRedis';

async function ensureRedisConnection() {
  const redis = setConnectionRedis();

  if (redis.status === 'wait') {
    await redis.connect();
  }

  return redis;
}

export async function acquireLock(key: string, ttlSeconds: number): Promise<boolean> {
  const redis = await ensureRedisConnection();
  const result = await redis.set(key, '1', 'EX', ttlSeconds, 'NX');
  return result === 'OK';
}

export async function releaseLock(key: string): Promise<void> {
  const redis = await ensureRedisConnection();
  await redis.del(key);
}
