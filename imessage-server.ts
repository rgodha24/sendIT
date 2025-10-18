import http from "node:http";
import Database from "better-sqlite3";
import { runDebateLogic, type Message } from "./src/lib/debate";

const PORT = 3001;
const ROUNDS = 5;

const db = new Database("debates.db");

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

function updateDebateMessages(debateId: string, messages: Message[]) {
  const stmt = db.prepare(`
    UPDATE debates SET messages = ? WHERE id = ?
  `);
  stmt.run(JSON.stringify(messages), debateId);
}

async function runDebate(question: string, debateId: string) {
  const allMessages: Message[] = [];

  await runDebateLogic(question, ROUNDS, async (message) => {
    allMessages.push(message);
    updateDebateMessages(debateId, allMessages);
  });

  const judgeMessage = allMessages.find((m) => m.type === "judge");
  return judgeMessage?.text || "";
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.url === "/api/imessage/trigger" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      try {
        const { question } = JSON.parse(body);
        const debateId = `debate-${Date.now()}`;
        
        const stmt = db.prepare(`
          INSERT INTO debates (id, question, messages, timestamp, is_favorite, reaction)
          VALUES (?, ?, ?, ?, 0, NULL)
        `);
        stmt.run(debateId, question, JSON.stringify([]), Date.now());

        runDebate(question, debateId).catch(console.error);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ debateId }));
      } catch (error) {
        console.error(error);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Failed to trigger debate" }));
      }
    });
    return;
  }

  if (req.url?.startsWith("/api/imessage/debate?debateId=")) {
    const debateId = new URL(req.url, `http://${req.headers.host}`).searchParams.get("debateId");
    
    if (!debateId) {
      res.writeHead(400);
      res.end();
      return;
    }

    const stmt = db.prepare(`
      SELECT id, question, messages, timestamp, is_favorite, reaction
      FROM debates
      WHERE id = ?
    `);
    const row = stmt.get(debateId) as any;

    if (!row) {
      res.writeHead(404);
      res.end();
      return;
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      id: row.id,
      question: row.question,
      messages: JSON.parse(row.messages),
      timestamp: row.timestamp,
    }));
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(PORT, () => {
  console.log(`
🎭 iMessage API Server Running!

🌐 Listening on http://localhost:${PORT}
📊 Database: debates.db

Ready to receive iMessage triggers...
`);
});
