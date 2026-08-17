import { MongoClient, type Collection, type Db } from "mongodb";
import type { ListingInput } from "@workspace/api-zod";

export type ListingDocument = ListingInput & {
  createdAt: Date;
  updatedAt: Date;
};

const rawMongoUri = process.env.MONGODB_URI?.trim();
const extractedMongoUri = rawMongoUri?.match(
  /mongodb(?:\+srv)?:\/\/[^\s`"'<>]+/,
)?.[0];
const mongoUri = extractedMongoUri?.replace(
  /(mongodb\+srv:\/\/[^@]+@[^/?]+):\d+(?=\/|\?|$)/,
  "$1",
);

if (!mongoUri) {
  throw new Error(
    "MONGODB_URI must contain a valid mongodb:// or mongodb+srv:// connection string.",
  );
}

const globalForMongo = globalThis as typeof globalThis & {
  __mizaanMongoClient?: MongoClient;
  __mizaanMongoDb?: Db;
};

const client = globalForMongo.__mizaanMongoClient ?? new MongoClient(mongoUri);
globalForMongo.__mizaanMongoClient = client;

export async function getListingsCollection(): Promise<
  Collection<ListingDocument>
> {
  if (!globalForMongo.__mizaanMongoDb) {
    await client.connect();
    globalForMongo.__mizaanMongoDb = client.db(
      process.env.MONGODB_DATABASE ?? "mizaan_properties",
    );
  }

  return globalForMongo.__mizaanMongoDb.collection<ListingDocument>("listings");
}