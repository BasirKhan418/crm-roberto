import { once } from "events";
import { createWriteStream } from "fs";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

import { EJSON } from "bson";
import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config({ path: ".env.local" });
dotenv.config();

const MONGO_URI = process.env.MONGO_URI ?? "";

if (!MONGO_URI) {
  console.error("MONGO_URI is not set in .env or .env.local");
  process.exit(1);
}

type ManifestEntry = {
  name: string;
  documents: number;
  file: string;
};

async function writeChunk(stream: ReturnType<typeof createWriteStream>, chunk: string) {
  if (stream.write(chunk)) {
    return;
  }

  await once(stream, "drain");
}

async function closeStream(stream: ReturnType<typeof createWriteStream>) {
  await new Promise<void>((resolve, reject) => {
    stream.on("error", reject);
    stream.end(() => resolve());
  });
}

async function writeCollectionFile(
  filePath: string,
  cursor: AsyncIterable<unknown>,
) {
  const stream = createWriteStream(filePath, { encoding: "utf8" });

  try {
    await writeChunk(stream, "[\n");

    let first = true;

    for await (const doc of cursor) {
      if (!first) {
        await writeChunk(stream, ",\n");
      }

      await writeChunk(stream, EJSON.stringify(doc));
      first = false;
    }

    await writeChunk(stream, "\n]\n");
  } catch (error) {
    stream.destroy();
    throw error;
  }

  await closeStream(stream);
}

async function main() {
  const outputArg = process.argv[2]?.trim();
  const outputDir = path.resolve(outputArg || "exports/mongodb");

  await mkdir(outputDir, { recursive: true });
  await mongoose.connect(MONGO_URI);

  try {
    const db = mongoose.connection.db;

    if (!db) {
      throw new Error("MongoDB connection did not expose a database handle");
    }

    const collections = (await db.listCollections({}, { nameOnly: true }).toArray())
      .map((collection) => collection.name)
      .sort((left, right) => left.localeCompare(right));

    const manifest: {
      generatedAt: string;
      database: string;
      totalCollections: number;
      totalDocuments: number;
      collections: ManifestEntry[];
    } = {
      generatedAt: new Date().toISOString(),
      database: db.databaseName,
      totalCollections: collections.length,
      totalDocuments: 0,
      collections: [],
    };

    console.log(`Connected to MongoDB database "${db.databaseName}"`);
    console.log(`Exporting ${collections.length} collections to ${outputDir}`);

    for (const collectionName of collections) {
      const collection = db.collection(collectionName);
      const fileName = `${collectionName}.json`;
      const filePath = path.join(outputDir, fileName);
      const documents = await collection.countDocuments();

      await writeCollectionFile(filePath, collection.find({}));

      manifest.totalDocuments += documents;
      manifest.collections.push({
        name: collectionName,
        documents,
        file: fileName,
      });

      console.log(`Exported ${collectionName}: ${documents} documents`);
    }

    const manifestPath = path.join(outputDir, "manifest.json");
    await writeFile(`${manifestPath}`, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

    console.log(`Wrote manifest: ${manifestPath}`);
    console.log(
      `Export complete: ${manifest.totalCollections} collections, ${manifest.totalDocuments} documents`,
    );
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error("MongoDB export failed:", error);
  process.exit(1);
});
