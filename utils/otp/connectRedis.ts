import Valkey from "ioredis";

let redisInstance: Valkey | null = null;

const REUSABLE_STATUSES = new Set([
    "wait",
    "connecting",
    "connect",
    "ready",
    "reconnecting",
]);

const setConnectionRedis = (): Valkey => {
    if (redisInstance && REUSABLE_STATUSES.has(redisInstance.status)) {
        return redisInstance;
    }
    
    const redisHost = process.env.REDIS_HOST;
    const redisPassword = process.env.REDIS_PASSWORD;
    
    if (!redisHost) {
        throw new Error('REDIS_HOST environment variable is required');
    }
    
    if (!redisPassword) {
        throw new Error('REDIS_PASSWORD environment variable is required');
    }
    
    const redisConfig = {
        host: redisHost,
        port: process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : 6379,
        username: process.env.REDIS_USER || 'default',
        password: redisPassword,
        tls: {},
        maxRetriesPerRequest: null,
        retryDelayOnClusterDown: 300,
        retryDelayOnFailover: 100,
        retryStrategy: (attempt: number) => Math.min(attempt * 200, 2000),
        lazyConnect: true,
        keepAlive: 30000, 
        connectTimeout: 10000,
        commandTimeout: 5000,
    };

    redisInstance = new Valkey(redisConfig);
    
    redisInstance.on('connect', () => {
        console.log('Redis connected successfully');
    });
    
    redisInstance.on('error', (error) => {
        console.error('Redis connection error:', error);
    });
    
    redisInstance.on('close', () => {
        console.log('Redis connection closed');
    });

    redisInstance.on('end', () => {
        console.log('Redis connection ended');
        redisInstance = null;
    });
    
    return redisInstance;
}

export const closeRedisConnection = async (): Promise<void> => {
    if (redisInstance) {
        try {
            await redisInstance.quit();
            redisInstance = null;
        } catch (error) {
            console.error('Error closing Redis connection:', error);
        }
    }
};

export default setConnectionRedis;