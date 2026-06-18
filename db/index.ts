export type DatabaseClient = {
  connect: () => Promise<void>;
};

export async function getDatabaseClient(): Promise<DatabaseClient> {
  return {
    async connect() {
      return Promise.resolve();
    },
  };
}
