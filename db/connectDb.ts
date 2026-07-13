import mongoose from "mongoose";

type MongooseCache = {
    conn: mongoose.Mongoose | null;
    promise: Promise<mongoose.Mongoose> | null;
};

declare global {
    var _mongooseCache: MongooseCache | undefined;
}

const globalForMongoose = globalThis as typeof globalThis & {
    _mongooseCache?: MongooseCache;
};

async function ConnectDb() {
    const mongoUri = process.env.MONGO_URI;

    if (!mongoUri) {
        throw new Error("MONGO_URI is not configured");
    }

    if (!globalForMongoose._mongooseCache) {
        globalForMongoose._mongooseCache = { conn: null, promise: null };
    }

    const cache = globalForMongoose._mongooseCache;

    if (cache.conn) {
        return cache.conn;
    }

    if (!cache.promise) {
        cache.promise = mongoose.connect(mongoUri);
    }

    try {
        cache.conn = await cache.promise;
        return cache.conn;
    } catch (error) {
        cache.promise = null;
        throw error;
    }
}

export default ConnectDb;