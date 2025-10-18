import Database from "better-sqlite3";

const FRIEND_HANDLE = "+14704527548";
const API_URL = "http://localhost:3001";
const POLL_MS = 2000;

const appDb = new Database("imessage-client.sqlite");
appDb.exec(`PRAGMA journal_mode = WAL;`);
appDb.exec(`
  CREATE TABLE IF NOT EXISTS state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )
`);

const CHAT_DB_PATH = `${process.env.HOME}/Library/Messages/chat.db`;
const chatDb = new Database(CHAT_DB_PATH, { readonly: true });

type InboundMessage = {
  rowid: number;
  guid: string;
  text: string | null;
  attributedBody: Uint8Array | null;
  is_from_me: number;
  handle: string | null;
  date: number | null;
};

const selectInbound = chatDb.prepare(`
  SELECT
    m.ROWID as rowid,
    m.guid as guid,
    m.text as text,
    m.attributedBody as attributedBody,
    m.is_from_me as is_from_me,
    h.id as handle,
    m.date as date
  FROM message m
  LEFT JOIN handle h ON h.ROWID = m.handle_id
  WHERE h.id = ?
    AND m.is_from_me = 0
    AND m.ROWID > ?
  ORDER BY m.ROWID ASC
`);

function decodeAttributedBody(attr: Uint8Array | null): string | null {
  if (!attr || attr.byteLength === 0) return null;

  for (let i = 0; i < attr.length - 3; i++) {
    if (attr[i] === 0x2b) {
      const len = attr[i + 1];
      if (len > 0 && len < 200 && i + 2 + len <= attr.length) {
        const textBytes = attr.slice(i + 2, i + 2 + len);
        try {
          const text = new TextDecoder("utf-8", { fatal: true }).decode(
            textBytes,
          );
          if (text.length > 0 && !text.includes("\x00")) {
            return text;
          }
        } catch {}
      }
    }
  }

  return null;
}

async function sendIM(handle: string, text: string) {
  try {
    const { exec } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const { writeFile, unlink } = await import("node:fs/promises");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const execAsync = promisify(exec);

    const escapedText = text.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const script = `tell application "Messages"
set targetService to 1st service whose service type = iMessage
set targetBuddy to buddy "${handle}" of targetService
send "${escapedText}" to targetBuddy
end tell`;

    const tempFile = join(tmpdir(), `imessage-${Date.now()}.scpt`);
    await writeFile(tempFile, script, "utf-8");

    try {
      await execAsync(`osascript "${tempFile}"`);
    } finally {
      await unlink(tempFile).catch(() => {});
    }
  } catch (e) {
    console.error("Error sending iMessage:", e);
  }
}

async function handleInboundMessage(_row: InboundMessage, content: string) {
  console.log(`[${new Date().toISOString()}] New message: "${content}"`);

  try {
    const response = await fetch(`${API_URL}/api/imessage/trigger`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: content }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    const { debateId } = await response.json();
    const debateUrl = `http://128.61.105.33:3000/debate/${debateId}`;

    console.log(`Debate created: ${debateId}`);
    await sendIM(FRIEND_HANDLE, `debate started: ${debateUrl}`);

    let attempts = 0;
    const maxAttempts = 200;

    while (attempts < maxAttempts) {
      const debateResponse = await fetch(
        `${API_URL}/api/imessage/debate?debateId=${debateId}`,
      );
      const debate = await debateResponse.json();

      if (debate && debate.messages) {
        const judgeMessage = debate.messages.find(
          (m: any) => m.type === "judge",
        );
        if (judgeMessage) {
          await sendIM(FRIEND_HANDLE, judgeMessage.text);
          break;
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
      attempts++;
    }
  } catch (error) {
    console.error("Error handling message:", error);
    await sendIM(FRIEND_HANDLE, "sorry something broke lol");
  }
}

function getLastProcessedRowId(): number {
  const result = appDb
    .prepare(`SELECT value FROM state WHERE key='last_rowid'`)
    .get() as { value: string } | undefined;
  return result ? Number(result.value) : 0;
}

function setLastProcessedRowId(v: number) {
  appDb.exec(
    `INSERT INTO state(key, value) VALUES ('last_rowid', '${v}') ON CONFLICT(key) DO UPDATE SET value='${v}'`,
  );
}

let polling = false;

async function pollOnce() {
  if (polling) return;
  polling = true;
  try {
    const last = getLastProcessedRowId();
    const rows = selectInbound.all(FRIEND_HANDLE, last) as InboundMessage[];

    if (!rows.length) return;

    let maxRowId = last;
    for (const row of rows) {
      const candidate =
        row.text && row.text.trim().length > 0
          ? row.text.trim()
          : decodeAttributedBody(row.attributedBody);

      if (!candidate) {
        maxRowId = Math.max(maxRowId, row.rowid);
        continue;
      }
      await handleInboundMessage(row, candidate);
      maxRowId = Math.max(maxRowId, row.rowid);
    }
    if (maxRowId > last) setLastProcessedRowId(maxRowId);
  } catch (e) {
    console.error("Poll error:", e);
  } finally {
    polling = false;
  }
}

setInterval(pollOnce, POLL_MS);

console.log(`
🎭 iMessage Client Running!

📱 Monitoring iMessages from: ${FRIEND_HANDLE}
🌐 API: ${API_URL}

Waiting for messages...
`);
