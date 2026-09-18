import { createClient, type Client, type InValue } from "@libsql/client";

let cachedClient: Client | null = null;

function client(): Client {
  if (cachedClient) return cachedClient;
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) throw new Error("DB_UNAVAILABLE");
  cachedClient = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  return cachedClient;
}

function rowsToObjects<T>(columns: string[], rows: ArrayLike<unknown>[]): T[] {
  return rows.map((row) => {
    const obj: Record<string, unknown> = {};
    columns.forEach((name, index) => { obj[name] = (row as unknown[])[index]; });
    return obj as T;
  });
}

export interface D1PreparedStatement {
  bind(...args: InValue[]): D1PreparedStatement;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<{ results: T[] }>;
  run(): Promise<{ success: boolean; meta: { changes: number } }>;
}

class Statement implements D1PreparedStatement {
  private args: InValue[] = [];

  constructor(private sql: string) {}

  bind(...args: InValue[]) {
    this.args = args;
    return this;
  }

  toLibsqlStatement() {
    return { sql: this.sql, args: this.args };
  }

  async first<T>() {
    const result = await client().execute(this.toLibsqlStatement());
    return result.rows.length ? rowsToObjects<T>(result.columns, result.rows)[0] : null;
  }

  async all<T>() {
    const result = await client().execute(this.toLibsqlStatement());
    return { results: rowsToObjects<T>(result.columns, result.rows) };
  }

  async run() {
    const result = await client().execute(this.toLibsqlStatement());
    return { success: true, meta: { changes: Number(result.rowsAffected) } };
  }
}

export function database() {
  return {
    prepare(sql: string): D1PreparedStatement {
      return new Statement(sql);
    },
    async batch(statements: D1PreparedStatement[]) {
      const stmts = statements.map((statement) => (statement as Statement).toLibsqlStatement());
      return client().batch(stmts, "write");
    },
  };
}

export function nowIso() {
  return new Date().toISOString();
}
