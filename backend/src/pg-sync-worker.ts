import { parentPort } from 'worker_threads';
import { Client } from 'pg';
import fs from 'fs';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is required for PostgreSQL worker');
}

const client = new Client({
  connectionString,
  ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false }
});

let ready = false;
let readyError = '';

client
  .connect()
  .then(() => {
    ready = true;
  })
  .catch((error) => {
    readyError = error instanceof Error ? error.message : String(error);
  });

function signal(flag: Int32Array, status: number) {
  Atomics.store(flag, 0, status);
  Atomics.notify(flag, 0);
}

parentPort?.on('message', async (message) => {
  const flag = new Int32Array(message.sharedBuffer);
  try {
    while (!ready && !readyError) {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }

    if (readyError) {
      throw new Error(readyError);
    }

    const result = await client.query(message.sql, message.params || []);
    fs.writeFileSync(
      message.resultPath,
      JSON.stringify({
        rows: result.rows,
        rowCount: result.rowCount || 0
      }),
      'utf8'
    );
    signal(flag, 1);
  } catch (error) {
    fs.writeFileSync(
      message.resultPath,
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error)
      }),
      'utf8'
    );
    signal(flag, 2);
  }
});
