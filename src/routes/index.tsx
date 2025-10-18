import { useState, useCallback, useEffect, useRef } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { debateServerFn, type Message } from "@/lib/debate";

export const Route = createFileRoute("/")({
	component: DebatePage,
});

type DebateHistory = {
	id: string;
	question: string;
	messages: Message[];
	timestamp: number;
	isFavorite?: boolean;
	reaction?: "thumbs-up" | "thumbs-down";
};

function DebatePage() {
	const navigate = useNavigate();
	const [question, setQuestion] = useState("");
	const [submittedQuestion, setSubmittedQuestion] = useState("");
	const [messages, setMessages] = useState<Message[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [typingIndicator, setTypingIndicator] = useState<
		"angel" | "devil" | null
	>(null);
	const [currentDebateId, setCurrentDebateId] = useState<string | null>(null);
	const messagesEndRef = useRef<HTMLDivElement>(null);

	// Auto-scroll to bottom when new messages arrive
	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages, typingIndicator]);

	// Load shared debate from URL
	useEffect(() => {
		const params = new URLSearchParams(window.location.search);
		const sharedDebate = params.get("debate");
		if (sharedDebate) {
			try {
				const decoded = JSON.parse(atob(sharedDebate));
				setSubmittedQuestion(decoded.question);
				setMessages(decoded.messages);
				setCurrentDebateId(`shared-${Date.now()}`);
			} catch (e) {
				console.error("Failed to load shared debate", e);
			}
		}
	}, []);

	// Save debate to history and navigate to it
	const saveDebateToHistory = useCallback(
		(debateId: string, question: string, messages: Message[]) => {
			const newDebate: DebateHistory = {
				id: debateId,
				question,
				messages,
				timestamp: Date.now(),
			};

			const saved = localStorage.getItem("debateHistory");
			const history: DebateHistory[] = saved ? JSON.parse(saved) : [];
			const updated = [newDebate, ...history].slice(0, 50);
			localStorage.setItem("debateHistory", JSON.stringify(updated));

			// Navigate to the debate detail page
			navigate({ to: "/debate/$id", params: { id: debateId } });
		},
		[navigate],
	);

	const startDebate = useCallback(async () => {
		if (!question.trim()) return;

		setIsLoading(true);

		const debateId = `debate-${Date.now()}`;
		setCurrentDebateId(debateId);

		const currentQuestion = question;
		setMessages([]);
		setSubmittedQuestion(currentQuestion);
		setQuestion("");

		const collectedMessages: Message[] = [];

		try {
			const stream = await debateServerFn({ data: { question: currentQuestion } });

			for await (const msg of stream) {
				console.log("Received message:", msg);

				// Show typing indicator before message appears
				if (msg.type === "devil") {
					setTypingIndicator("devil");
					await new Promise((resolve) => setTimeout(resolve, 800));
				} else if (msg.type === "angel") {
					setTypingIndicator("angel");
					await new Promise((resolve) => setTimeout(resolve, 800));
				} else if (msg.type === "judge") {
					setTypingIndicator(null);
				}

				collectedMessages.push(msg);
				setMessages((prev) => [...prev, msg]);
				setTypingIndicator(null);
			}

			// Save completed debate to history and navigate
			saveDebateToHistory(debateId, currentQuestion, collectedMessages);
		} catch (error) {
			console.error("Debate error:", error);
			console.error("Error details:", error);
		} finally {
			setIsLoading(false);
			setTypingIndicator(null);
		}
	}, [question, saveDebateToHistory]);

	return (
		<div className="min-h-screen bg-[#f5f5f5] flex flex-col">
			<div className="max-w-2xl mx-auto w-full flex-1 flex flex-col">
				{/* Header */}
				<div className="bg-white border-b border-gray-300 px-4 py-3 flex items-center justify-between shadow-sm">
					<Link
						to="/history"
						className="text-[#007AFF] text-lg font-semibold hover:opacity-70"
						aria-label="View history"
					>
						‹
					</Link>
					<div className="flex items-center gap-2">
						<div className="flex -space-x-2">
							<div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs border-2 border-white shadow">
								😇
							</div>
							<div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center text-white text-xs border-2 border-white shadow">
								😈
							</div>
						</div>
						<div className="text-center">
							<div className="font-semibold text-gray-900">angel vs devil</div>
							<div className="text-xs text-gray-600">2 participants</div>
						</div>
					</div>
					<div className="w-6" />
				</div>

				{/* Messages Area */}
				<div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
					{!submittedQuestion && messages.length === 0 && (
						<div className="flex justify-center items-center h-full">
							<div className="text-center">
								{/* Empty state illustration */}
								<div className="mb-4 flex justify-center gap-4">
									<div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center text-4xl animate-pulse">
										😇
									</div>
									<div
										className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center text-4xl animate-pulse"
										style={{ animationDelay: "0.5s" }}
									>
										😈
									</div>
								</div>
								<p className="text-gray-600 text-base font-medium">
									Ask a question to start the debate
								</p>
								<p className="text-gray-500 text-sm mt-2">
									Angel and Devil will argue it out
								</p>
							</div>
						</div>
					)}
					{submittedQuestion && (
						<div className="flex flex-col gap-1 mb-4">
							<div className="flex justify-end">
								<div className="max-w-[75%] px-4 py-2 bg-[#007AFF] text-white rounded-[18px] rounded-tr-[4px] shadow-sm">
									<div className="text-[17px] leading-[22px]">
										{submittedQuestion}
									</div>
								</div>
							</div>
						</div>
					)}

					{/* Messages */}
					{messages.map((msg, idx) => {
						const isDevil = msg.type === "devil";
						const isJudge = msg.type === "judge";

						return (
							<div key={idx} className="flex flex-col gap-1">
								<div className="text-xs text-gray-700 px-2 text-left font-medium">
									{isJudge ? "Judge ⚖️" : isDevil ? "Devil 😈" : "Angel 😇"}
								</div>
								<div className="flex justify-start">
									<div
										className={`max-w-[75%] px-4 py-2 shadow-sm ${
											isJudge
												? "bg-gray-300 text-gray-900 rounded-2xl font-medium"
												: "bg-[#E9E9EB] text-gray-900 rounded-[18px] rounded-tl-[4px]"
										}`}
									>
										<div className="text-[17px] leading-[22px]">{msg.text}</div>
									</div>
								</div>
							</div>
						);
					})}

					{/* Typing indicator */}
					{typingIndicator && (
						<div className="flex flex-col gap-1">
							<div className="text-xs text-gray-700 px-2 text-left font-medium">
								{typingIndicator === "devil" ? "Devil 😈" : "Angel 😇"}
							</div>
							<div className="flex justify-start">
								<div className="max-w-[75%] px-4 py-2 bg-[#E9E9EB] text-gray-900 rounded-[18px] rounded-tl-[4px] shadow-sm">
									<div className="flex gap-1">
										<span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" />
										<span
											className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"
											style={{ animationDelay: "0.2s" }}
										/>
										<span
											className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"
											style={{ animationDelay: "0.4s" }}
										/>
									</div>
								</div>
							</div>
						</div>
					)}

					<div ref={messagesEndRef} />
				</div>

				{/* Input Area */}
				<div className="bg-white border-t border-gray-300 px-4 py-2 shadow-sm">
					<div className="flex items-center gap-2">
						<button
							type="button"
							className="text-gray-500 text-2xl hover:text-gray-700"
							aria-label="More options"
						>
							+
						</button>
						<div className="flex-1 bg-[#f5f5f5] rounded-full px-4 py-2 flex items-center gap-2 border border-gray-300">
							<input
								type="text"
								value={question}
								onChange={(e) => setQuestion(e.target.value)}
								onKeyDown={(e) => e.key === "Enter" && !isLoading && startDebate()}
								placeholder="should i..."
								className="flex-1 bg-transparent border-none outline-none text-gray-900 placeholder-gray-500"
								disabled={isLoading}
								aria-label="Question input"
							/>
						</div>
						<button
							type="button"
							onClick={() => startDebate()}
							disabled={isLoading || !question.trim()}
							className="w-8 h-8 rounded-full bg-[#007AFF] text-white disabled:bg-gray-400 flex items-center justify-center font-bold hover:bg-blue-600 transition-colors"
							aria-label="Send message"
						>
							{isLoading ? "..." : "↑"}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
