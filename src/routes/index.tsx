import { useState, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { debateServerFn, type Message } from "@/lib/debate";

export const Route = createFileRoute("/")({
	component: DebatePage,
});

function DebatePage() {
	const [question, setQuestion] = useState("");
	const [submittedQuestion, setSubmittedQuestion] = useState("");
	const [messages, setMessages] = useState<Message[]>([]);
	const [isLoading, setIsLoading] = useState(false);

	const startDebate = useCallback(async () => {
		if (!question.trim()) return;

		setIsLoading(true);
		setMessages([]);
		setSubmittedQuestion(question);
		setQuestion("");

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
		<div className="min-h-screen bg-[#f5f5f5] flex flex-col">
			<div className="max-w-2xl mx-auto w-full flex-1 flex flex-col">
				<div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
					<button className="text-[#007AFF] text-lg">‹</button>
					<div className="flex items-center gap-2">
						<div className="flex -space-x-2">
							<div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs border-2 border-white">
								😇
							</div>
							<div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center text-white text-xs border-2 border-white">
								😈
							</div>
						</div>
						<div className="text-center">
							<div className="font-semibold text-black">angel vs devil</div>
							<div className="text-xs text-gray-500">2 participants</div>
						</div>
					</div>
					<button className="text-[#007AFF] text-2xl">⋯</button>
				</div>

				<div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
					{!submittedQuestion && messages.length === 0 && (
						<div className="flex justify-center items-center h-full">
							<div className="text-center text-gray-400 text-sm">
								Ask a question to start the debate
							</div>
						</div>
					)}
					{submittedQuestion && (
						<div className="flex flex-col gap-1 mb-4">
							<div className="flex justify-end">
								<div className="max-w-[75%] px-4 py-2 bg-[#007AFF] text-white rounded-[18px] rounded-tr-[4px]">
									<div className="text-[17px] leading-[22px]">
										{submittedQuestion}
									</div>
								</div>
							</div>
						</div>
					)}
					{messages.map((msg, idx) => {
						const isDevil = msg.type === "devil";
						const isJudge = msg.type === "judge";

						return (
							<div key={idx} className="flex flex-col gap-1">
								<div className="text-xs text-gray-500 px-2 text-left">
									{isJudge ? "Judge" : isDevil ? "Devil 😈" : "Angel 😇"}
								</div>
								<div className="flex justify-start">
									<div
										className={`max-w-[75%] px-4 py-2 ${
											isJudge
												? "bg-gray-200 text-black rounded-2xl"
												: "bg-[#E9E9EB] text-black rounded-[18px] rounded-tl-[4px]"
										}`}
									>
										<div className="text-[17px] leading-[22px]">{msg.text}</div>
									</div>
								</div>
							</div>
						);
					})}
				</div>

				<div className="bg-white border-t border-gray-200 px-4 py-2">
					<div className="flex items-center gap-2">
						<button className="text-gray-400 text-2xl">+</button>
						<div className="flex-1 bg-[#f5f5f5] rounded-full px-4 py-2 flex items-center gap-2">
							<input
								type="text"
								value={question}
								onChange={(e) => setQuestion(e.target.value)}
								onKeyDown={(e) => e.key === "Enter" && startDebate()}
								placeholder="should i..."
								className="flex-1 bg-transparent border-none outline-none text-black placeholder-gray-400"
								disabled={isLoading}
							/>
						</div>
						<button
							type="button"
							onClick={startDebate}
							disabled={isLoading || !question.trim()}
							className="text-[#007AFF] disabled:text-gray-400"
						>
							{isLoading ? "..." : "↑"}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
