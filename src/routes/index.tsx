import { useState, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { debateServerFn, type Message } from "@/lib/debate";
import { testStreamFn } from "@/lib/test-stream";

export const Route = createFileRoute("/")({
  component: DebatePage,
});

function DebatePage() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const startDebate = useCallback(async () => {
    if (!question.trim()) return;

    setIsLoading(true);
    setMessages([]);

    try {
      const stream = await debateServerFn({ data: { question } });

      for await (const msg of stream) {
        console.log("Received message:", msg);
        setMessages((prev) => [...prev, msg]);
      }
    } catch (error) {
      console.error("Debate error:", error);
      console.error("Error details:", error);
    } finally {
      setIsLoading(false);
    }
  }, [question]);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <div className="max-w-2xl mx-auto w-full flex-1 flex flex-col p-4">
        <div className="mb-6 pt-8">
          <h1 className="text-3xl font-bold mb-4">angel vs devil</h1>
          <div className="flex gap-2">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && startDebate()}
              placeholder="should i..."
              className="flex-1 px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-lg focus:outline-none focus:border-zinc-700"
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={startDebate}
              disabled={isLoading || !question.trim()}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-800 disabled:text-zinc-600 rounded-lg font-medium transition-colors"
            >
              {isLoading ? "..." : "ask"}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pb-4">
          {messages.map((msg, idx) => {
            const isDevil = msg.type === "devil";
            const isJudge = msg.type === "judge";

            return (
              <div
                key={idx}
                className={`flex ${isDevil ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] px-4 py-2 rounded-2xl ${
                    isJudge
                      ? "bg-yellow-900/30 border border-yellow-800/50"
                      : isDevil
                        ? "bg-red-900/30 border border-red-800/50"
                        : "bg-blue-900/30 border border-blue-800/50"
                  }`}
                >
                  <div className="text-xs mb-1 opacity-60">
                    {isJudge ? "judge" : isDevil ? "devil" : "angel"}
                  </div>
                  <div className="text-sm">{msg.text}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
