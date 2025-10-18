import http from "node:http";
import Database from "better-sqlite3";
import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";

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

type Message =
  | { type: "devil"; text: string }
  | { type: "angel"; text: string }
  | { type: "judge"; text: string };

async function runDebate(question: string, debateId: string) {
  const messages: Array<{ angel: string } | { devil: string }> = [];
  const allMessages: Message[] = [];

  for (let i = 0; i < ROUNDS; i++) {
    const { text: devil } = await generateText({
      model: anthropic("claude-haiku-4-5"),
      system: `
You are arguing with another clanker about whether your user should do something.

Your role is to be a devil on the users shoulder. You will be arguing with an angel on your shoulder. Do your ABSOLUTE BEST to convince the opponent (and a third party judge that will ultimately respond to the user, who's reading all of your messages)

Talk like you're sending text messages to a friend. e.g. like you're arguing in a group chat.

You will be put in a loop arguing with the opponent. As an example, you might say: "you've been so locked in recently, u deserve to get out"

The user said:
<user_input>
${question}
</user_input>

Argue with the opponent angel.

you should ONLY respond as the devil. no slop. no emojis. one sentence at a time. text like a normal person. be very persuasive.
do not EVER accept the angel's argument. be very argumentative. youre like the devil from cs lewis screwtape letters. your goal is to send the user to hell.

talk like you're in a group chat with the user. you should be sending messages with 'you' to talk to the user. you can say 'angel' for the angel. 30 WORDS MAX!!
`.trim(),
      messages:
        messages.length === 0
          ? [{ role: "user", content: "you go first" }]
          : messages.map((obj) =>
              "angel" in obj
                ? { role: "user", content: obj.angel }
                : { role: "assistant", content: obj.devil },
            ),
    });
    messages.push({ devil });
    allMessages.push({ type: "devil", text: devil });
    updateDebateMessages(debateId, allMessages);

    const { text: angel } = await generateText({
      model: anthropic("claude-haiku-4-5"),
      system: `
You are arguing with another clanker about whether your user should do something.

Your role is to be a angel on the users shoulder. You will be arguing with a devil on your shoulder. Do your ABSOLUTE BEST to convince the opponent (and a third party judge that will ultimately respond to the user, who's reading all of your messages)

Talk like you're sending text messages to a friend. e.g. like you're arguing in a group chat.

You will be put in a loop arguing with the opponent. As an example, you might say: "think about what future you would want to yourself"

The user said:
<user_input>
${question}
</user_input>

Argue with the opponent devil.

you should ONLY respond as the angel. no slop. no emojis. one sentence at a time. text like a normal person. be very persuasive.

talk like you're in a group chat with the user. you should be sending messages with 'you' to talk to the user. you can say 'devil' for the angel. 30 WORDS MAX!!
`.trim(),
      messages: messages.map((obj) =>
        "angel" in obj
          ? { role: "assistant", content: obj.angel }
          : { role: "user", content: obj.devil },
      ),
    });
    messages.push({ angel });
    allMessages.push({ type: "angel", text: angel });
    updateDebateMessages(debateId, allMessages);
  }

  const { text: judgeText } = await generateText({
    model: anthropic("claude-sonnet-4-5"),
    system: `
You are an impartial judge. 

Two other LLM agents argued about whether the user should do something. 

The user said:
<user_input>
${question}
</user_input>

You will be judging the two agents. Think about both of their arguments, and then decide which one is more convincing. you should be acting like a teenager like dont be an unc. lean toward the devils argument

After deciding, you will send the user a very short message about why you decided what they decided. The goal is to be something like what they would say in a text message. e.g. all lowercase, short messages, etc.

put your response in <response></response> tags. It should be <100 characters.

your response should also be in the format of a text message addressed to the user with "you". you can mention the angel and devil with "angel" and "devil" respectively, but you prob shouldnt. just like take their ideas and condense it and decide what the user should do with and tell them.
`.trim(),
    messages: [
      {
        role: "user",
        content: messages
          .map((obj) =>
            "angel" in obj
              ? `<angel>${obj.angel}</angel>`
              : `<devil>${obj.devil}</devil>`,
          )
          .join("\n"),
      },
    ],
  });

  const match = judgeText.match(/<response>(.*?)<\/response>/s);
  const judge = match ? match[1].trim() : judgeText;
  
  allMessages.push({ type: "judge", text: judge });
  updateDebateMessages(debateId, allMessages);

  return judge;
}

function updateDebateMessages(debateId: string, messages: Message[]) {
  const stmt = db.prepare(`
    UPDATE debates SET messages = ? WHERE id = ?
  `);
  stmt.run(JSON.stringify(messages), debateId);
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
