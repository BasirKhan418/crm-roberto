import Valkey from "ioredis";

let redisInstance: Valkey | null = null;

const setConnectionRedis = (): Valkey => {
    if (redisInstance && redisInstance.status === 'ready') {
        return redisInstance;
    }
    
    const redisHost = process.env.REDIS_HOST;
    const redisPassword = process.env.REDIS_PASSWORD;
    
    if (!redisHost) {
        throw new Error('REDIS_HOST environment variable is required');
    }
    
    const redisConfig: any = {
        host: redisHost,
        port: process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : 6379,
        maxRetriesPerRequest: 3,
        retryDelayOnClusterDown: 300,
        retryDelayOnFailover: 100,
        lazyConnect: true,
        keepAlive: 30000, 
        connectTimeout: 10000,
        commandTimeout: 5000,
    };

    if (process.env.REDIS_USER) {
        redisConfig.username = process.env.REDIS_USER;
    }
    
    if (redisPassword) {
        redisConfig.password = redisPassword;
        redisConfig.tls = {};
    }

    redisInstance = new Valkey(redisConfig);
    
    redisInstance.on('connect', () => {
        console.log('Redis connected successfully');
    });
    
    redisInstance.on('error', (error) => {
        console.error('Redis connection error:', error);
        redisInstance = null;
    });
    
    redisInstance.on('close', () => {
        console.log('Redis connection closed');
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