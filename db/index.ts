import "server-only";

import { Db, MongoClient, ServerApiVersion } from "mongodb";

const globalForMongo = globalThis as typeof globalThis & {
  mongoClientPromise?: Promise<MongoClient>;
};

export type DatabaseConnectionDetails = {
  database: string;
  hosts: string[];
  applicationName: string;
  environment: string;
  devMode: boolean;
  status: "connected";
};

function isDevMode() {
  return process.env.DEV_MODE?.trim().toLowerCase() === "true";
}

function getConfiguration() {
  const uri = process.env.MONGODB_URI?.trim();
  const database = process.env.MONGODB_DB?.trim();

  if (!uri) throw new Error("MONGODB_URI is not configured.");
  if (!database) throw new Error("MONGODB_DB is not configured.");

  return { uri, database };
}

function describeConnection(client: MongoClient, database: string): DatabaseConnectionDetails {
  const hosts = Array.from(client.options.hosts, (host) => host.toString());

  return {
    database,
    hosts,
    applicationName: client.options.appName ?? "kgm-hiring",
    environment: process.env.NODE_ENV ?? "development",
    devMode: isDevMode(),
    status: "connected",
  };
}

export async function connectToDatabase(): Promise<MongoClient> {
  const { uri, database } = getConfiguration();

  if (!globalForMongo.mongoClientPromise) {
    const client = new MongoClient(uri, {
      appName: "kgm-hiring",
      serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
    });

    globalForMongo.mongoClientPromise = client.connect().then(async (connectedClient) => {
      await connectedClient.db(database).command({ ping: 1 });
      const details = describeConnection(connectedClient, database);
      console.info("[database] MongoDB connection successful.");
      console.info(`[database] DEV_MODE is ${details.devMode ? "ON" : "OFF"}.`);
      if (details.devMode) console.info("[database] Connection details:", details);
      return connectedClient;
    }).catch((error) => {
      globalForMongo.mongoClientPromise = undefined;
      throw error;
    });
  }

  return globalForMongo.mongoClientPromise;
}

export async function getDatabase(): Promise<Db> {
  const { database } = getConfiguration();
  return (await connectToDatabase()).db(database);
}

export async function getDatabaseConnectionDetails(): Promise<DatabaseConnectionDetails> {
  const { database } = getConfiguration();
  return describeConnection(await connectToDatabase(), database);
}
