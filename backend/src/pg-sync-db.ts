import { Worker } from 'worker_threads';
import fs from 'fs';
import os from 'os';
import path from 'path';

type RunResult = {
  lastInsertRowid: number;
  changes: number;
};

type QueryResult = {
  rows: any[];
  rowCount: number;
};

let worker: Worker | null = null;
let queryId = 0;

function getWorker() {
  if (!worker) {
    worker = new Worker(path.join(__dirname, 'pg-sync-worker.js'), {
      env: process.env
    });
  }
  return worker;
}

function convertPlaceholders(sql: string) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

function normalizeSql(sql: string, forRun = false) {
  let normalized = sql.trim();

  normalized = normalized
    .replace(/INTEGER PRIMARY KEY AUTOINCREMENT/gi, 'SERIAL PRIMARY KEY')
    .replace(/datetime\('now'\)/gi, 'CURRENT_TIMESTAMP')
    .replace(/date\('now',\s*'localtime'\)/gi, 'CURRENT_DATE')
    .replace(/date\('now',\s*'\+(\d+) days'\)/gi, "CURRENT_DATE + INTERVAL '$1 days'")
    .replace(/date\('now'\)/gi, 'CURRENT_DATE')
    .replace(/datetime\(([\w.]+)\)/gi, '($1)::timestamp')
    .replace(/date\(([\w.]+)\)/gi, '($1)::date')
    .replace(/DEFAULT CURRENT_TIMESTAMP/gi, 'DEFAULT (CURRENT_TIMESTAMP::text)')
    .replace(/INSERT OR IGNORE INTO/gi, 'INSERT INTO')
    .replace(/INSERT OR REPLACE INTO/gi, 'INSERT INTO')
    .replace(/\bREAL\b/gi, 'DOUBLE PRECISION');

  normalized = convertPlaceholders(normalized);

  if (/^INSERT\s+/i.test(normalized) && /INSERT OR IGNORE/i.test(sql) && !/\bON\s+CONFLICT\b/i.test(normalized)) {
    normalized += ' ON CONFLICT DO NOTHING';
  }

  if (forRun && /^INSERT\s+/i.test(normalized) && !/\bRETURNING\b/i.test(normalized)) {
    normalized += ' RETURNING id';
  }

  return normalized;
}

function splitStatements(sql: string) {
  return sql
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean);
}

function execute(sql: string, params: any[] = []): QueryResult {
  const id = ++queryId;
  const sharedBuffer = new SharedArrayBuffer(4);
  const flag = new Int32Array(sharedBuffer);
  const resultPath = path.join(os.tmpdir(), `transportadora-pg-${process.pid}-${id}.json`);

  getWorker().postMessage({ sql, params, sharedBuffer, resultPath });
  Atomics.wait(flag, 0, 0);

  const payload = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
  try {
    fs.unlinkSync(resultPath);
  } catch {}

  if (payload.error) {
    throw new Error(payload.error);
  }

  return payload;
}

class PgStatement {
  constructor(private sql: string) {}

  all(...params: any[]) {
    const result = execute(normalizeSql(this.sql), params);
    return result.rows;
  }

  get(...params: any[]) {
    return this.all(...params)[0];
  }

  run(...params: any[]): RunResult {
    let result: QueryResult;
    try {
      result = execute(normalizeSql(this.sql, true), params);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/column "id" does not exist/i.test(message)) {
        throw error;
      }
      result = execute(normalizeSql(this.sql), params);
    }
    return {
      lastInsertRowid: result.rows[0]?.id || 0,
      changes: result.rowCount
    };
  }
}

export class PgSyncDatabase {
  prepare(sql: string) {
    return new PgStatement(sql);
  }

  exec(sql: string) {
    for (const statement of splitStatements(sql)) {
      execute(normalizeSql(statement));
    }
  }

  transaction<T extends (...args: any[]) => any>(callback: T): T {
    return ((...args: any[]) => {
      execute('BEGIN');
      try {
        const result = callback(...args);
        execute('COMMIT');
        return result;
      } catch (error) {
        execute('ROLLBACK');
        throw error;
      }
    }) as T;
  }
}

export function createPgDatabase() {
  return new PgSyncDatabase();
}
