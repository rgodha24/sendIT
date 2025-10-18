import Database from "better-sqlite3";
import { join } from "node:path";

const dbPath = join(process.cwd(), "debates.db");
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS debates (
    id TEXT PRIMARY KEY,
    question TEXT NOT NULL,
    messages TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    is_favorite INTEGER DEFAULT 0,
    reaction TEXT
  )
`);

export { db };
