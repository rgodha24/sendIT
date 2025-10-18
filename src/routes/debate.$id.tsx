import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef, useCallback } from "react";
import type { Message } from "@/lib/debate";

type DebateHistory = {
	id: string;
	question: string;
	messages: Message[];
	timestamp: number;
	isFavorite?: boolean;
	reaction?: "thumbs-up" | "thumbs-down";
};

export const Route = createFileRoute("/debate/$id")({
	component: DebateDetailPage,
});

function DebateDetailPage() {
	const { id } = Route.useParams();
	const navigate = useNavigate();
	const [debate, setDebate] = useState<DebateHistory | null>(null);
	const messagesEndRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const saved = localStorage.getItem("debateHistory");
		if (saved) {
			try {
				const history: DebateHistory[] = JSON.parse(saved);
				const found = history.find((d) => d.id === id);
				if (found) {
					setDebate(found);
				} else {
					// Debate not found, redirect to home
					navigate({ to: "/" });
				}
			} catch (e) {
				console.error("Failed to load debate", e);
				navigate({ to: "/" });
			}
		} else {
			navigate({ to: "/" });
		}
	}, [id, navigate]);

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [debate]);

	const shareDebate = useCallback(() => {
		if (!debate) return;

		const debateData = {
			question: debate.question,
			messages: debate.messages,
		};
		const encoded = btoa(JSON.stringify(debateData));
		const shareUrl = `${window.location.origin}?debate=${encoded}`;

		navigator.clipboard
			.writeText(shareUrl)
			.then(() => {
				alert("Debate link copied to clipboard!");
			})
			.catch(() => {
				alert(`Share this link:\n${shareUrl}`);
			});
	}, [debate]);

	if (!debate) {
		return (
			<div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center">
				<div className="text-gray-600">Loading...</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-[#f5f5f5] flex flex-col">
			<div className="max-w-2xl mx-auto w-full flex-1 flex flex-col">
				{/* Header */}
				<div className="bg-white border-b border-gray-300 px-4 py-3 flex items-center justify-between shadow-sm">
					<Link
						to="/history"
						className="text-[#007AFF] text-lg font-semibold hover:opacity-70"
						aria-label="Back to history"
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
					<button
						type="button"
						onClick={shareDebate}
						className="text-[#007AFF] text-xl hover:opacity-70"
						aria-label="Share debate"
					>
						⤴
					</button>
				</div>

				{/* Messages Area */}
				<div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
					{/* User Question */}
					<div className="flex flex-col gap-1 mb-4">
						<div className="flex justify-end">
							<div className="max-w-[75%] px-4 py-2 bg-[#007AFF] text-white rounded-[18px] rounded-tr-[4px] shadow-sm">
								<div className="text-[17px] leading-[22px]">
									{debate.question}
								</div>
							</div>
						</div>
					</div>

					{/* Messages */}
					{debate.messages.map((msg, idx) => {
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

					<div ref={messagesEndRef} />
				</div>
			</div>
		</div>
	);
}
