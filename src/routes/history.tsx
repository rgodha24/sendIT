import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import type { Message } from "@/lib/debate";

type DebateHistory = {
	id: string;
	question: string;
	messages: Message[];
	timestamp: number;
	isFavorite?: boolean;
	reaction?: "thumbs-up" | "thumbs-down";
};

export const Route = createFileRoute("/history")({
	component: HistoryPage,
});

function HistoryPage() {
	const [debateHistory, setDebateHistory] = useState<DebateHistory[]>([]);

	useEffect(() => {
		const saved = localStorage.getItem("debateHistory");
		if (saved) {
			try {
				setDebateHistory(JSON.parse(saved));
			} catch (e) {
				console.error("Failed to load debate history", e);
			}
		}
	}, []);

	const toggleFavorite = (debateId: string) => {
		const updated = debateHistory.map((d) =>
			d.id === debateId ? { ...d, isFavorite: !d.isFavorite } : d,
		);
		setDebateHistory(updated);
		localStorage.setItem("debateHistory", JSON.stringify(updated));
	};

	const deleteDebate = (debateId: string) => {
		const updated = debateHistory.filter((d) => d.id !== debateId);
		setDebateHistory(updated);
		localStorage.setItem("debateHistory", JSON.stringify(updated));
	};

	return (
		<div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
			<div className="max-w-2xl mx-auto">
				{/* Header */}
				<div className="bg-white border-b border-gray-300 px-4 py-3 flex items-center justify-between shadow-sm sticky top-0 z-10">
					<Link
						to="/"
						className="text-[#007AFF] text-lg font-semibold hover:opacity-70"
					>
						‹ Back
					</Link>
					<h1 className="text-lg font-semibold text-gray-900">
						Debate History
					</h1>
					<Link
						to="/"
						className="px-4 py-2 bg-[#007AFF] text-white rounded-full text-sm font-semibold hover:bg-blue-600 shadow-sm transition-colors flex items-center gap-2"
					>
						<span className="text-lg">+</span>
						New
					</Link>
				</div>

				{/* History List */}
				<div className="p-6">
					{debateHistory.length === 0 ? (
						<div className="text-center py-16">
							<div className="mb-4 text-6xl opacity-30">💭</div>
							<p className="text-gray-600 text-lg font-medium">No debates yet</p>
							<p className="text-gray-500 text-sm mt-2">
								Start your first debate to see it here
							</p>
							<Link
								to="/"
								className="inline-block mt-6 px-6 py-3 bg-[#007AFF] text-white rounded-full font-semibold hover:bg-blue-600"
							>
								Start a Debate
							</Link>
						</div>
					) : (
						<div className="space-y-3">
							{debateHistory.map((debate) => {
								const hasJudge = debate.messages.some((m) => m.type === "judge");
								const judgeMessage = debate.messages.find(
									(m) => m.type === "judge",
								);

								return (
									<Link
										key={debate.id}
										to="/debate/$id"
										params={{ id: debate.id }}
										className="block"
									>
										<div className="group bg-white border-2 border-gray-200 rounded-2xl p-4 hover:border-[#007AFF] hover:shadow-lg transition-all duration-200">
											<div className="flex justify-between items-start mb-2">
												<h3
													onClick={() => {}}
													className="text-gray-900 font-semibold flex-1 text-base group-hover:text-[#007AFF] transition-colors cursor-pointer"
												>
													{debate.question}
												</h3>
												<div className="flex items-center gap-2 ml-3">
													<button
														type="button"
														onClick={(e) => {
															e.preventDefault();
															e.stopPropagation();
															toggleFavorite(debate.id);
														}}
														className="text-2xl hover:scale-110 transition-transform"
														aria-label="Toggle favorite"
													>
														{debate.isFavorite ? "⭐" : "☆"}
													</button>
													<button
														type="button"
														onClick={(e) => {
															e.preventDefault();
															e.stopPropagation();
															if (
																confirm(
																	"Are you sure you want to delete this debate?",
																)
															) {
																deleteDebate(debate.id);
															}
														}}
														className="text-xl text-red-500 hover:scale-110 transition-transform"
														aria-label="Delete debate"
													>
														🗑️
													</button>
												</div>
											</div>

											{hasJudge && judgeMessage && (
												<div className="bg-gray-50 rounded-lg p-3 mb-3 border border-gray-200">
													<div className="flex items-center gap-2 mb-1">
														<span className="text-xs font-semibold text-gray-700">
															⚖️ Judge's Verdict
														</span>
													</div>
													<p className="text-sm text-gray-700 line-clamp-2">
														{judgeMessage.text}
													</p>
												</div>
											)}

											<div className="flex items-center gap-3 text-xs text-gray-600">
												<span className="flex items-center gap-1">
													<span className="font-medium">
														{debate.messages.length}
													</span>
													messages
												</span>
												<span className="w-1 h-1 bg-gray-400 rounded-full" />
												<span>
													{new Date(debate.timestamp).toLocaleDateString()}
												</span>
											</div>
										</div>
									</Link>
								);
							})}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
