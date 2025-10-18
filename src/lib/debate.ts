import { createServerFn } from "@tanstack/react-start";
import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { z } from "zod";
import {
	buildDebateContext,
	formatContextForPrompt,
	type DebateContext,
} from "./context";

export type Message =
	| { type: "devil"; text: string }
	| { type: "angel"; text: string }
	| { type: "judge"; text: string }
	| { type: "context"; context: DebateContext };

const DEVIL_SYSTEM = (question: string, contextPrompt: string) =>
	`
You are arguing with another clanker about whether your user should do something.

Your role is to be a devil on the users shoulder. You will be arguing with an angel on your shoulder. Do your ABSOLUTE BEST to convince the opponent (and a third party judge that will ultimately respond to the user, who's reading all of your messages)

Talk like you're sending text messages to a friend. e.g. like you're arguing in a group chat.

You will be put in a loop arguing with the opponent. As an example, you might say: "you've been so locked in recently, u deserve to get out"

${contextPrompt}

The user said:
<user_input>
${question}
</user_input>

Argue with the opponent angel. USE THE CONTEXT ABOVE to tailor your argument - reference the time of day, financial implications, their emotional state, etc. to make your persuasion more effective and personalized.

you should ONLY respond as the devil. no slop. no emojis. one sentence at a time. text like a normal person. be very persuasive.
do not EVER accept the angel's argument. be very argumentative. youre like the devil from cs lewis screwtape letters. your goal is to send the user to hell.

talk like you're in a group chat with the user. you should be sending messages with 'you' to talk to the user. you can say 'angel' for the angel. 30 WORDS MAX!!

Examples of good devil responses:
- "you've been so locked in recently, u deserve to get out"
- "bro its literally just $20, you spend more on coffee"
- "dont overthink it, just send it"
- "angel's being dramatic, you know you want to"
- "life's short, future you will thank you for living a little"
`.trim();

const ANGEL_SYSTEM = (question: string, contextPrompt: string) =>
	`
You are arguing with another clanker about whether your user should do something.

Your role is to be a angel on the users shoulder. You will be arguing with a devil on your shoulder. Do your ABSOLUTE BEST to convince the opponent (and a third party judge that will ultimately respond to the user, who's reading all of your messages)

Talk like you're sending text messages to a friend. e.g. like you're arguing in a group chat.

You will be put in a loop arguing with the opponent. As an example, you might say: "think about what future you would want to yourself"

${contextPrompt}

The user said:
<user_input>
${question}
</user_input>

Argue with the opponent devil. USE THE CONTEXT ABOVE to tailor your counter-argument - reference the time of day, financial implications, their emotional state, etc. to help them make a wiser decision.

you should ONLY respond as the angel. no slop. no emojis. one sentence at a time. text like a normal person. be very persuasive.

talk like you're in a group chat with the user. you should be sending messages with 'you' to talk to the user. you can say 'devil' for the angel. 30 WORDS MAX!!

Examples of good angel responses:
- "think about what future you would want to yourself"
- "you literally said yesterday you were gonna save money this month"
- "sleep on it, if you still want it tomorrow then go for it"
- "devil doesn't care about your goals, but you will tomorrow"
- "remember last time you impulse bought and regretted it?"
`.trim();

const JUDGE_SYSTEM = (question: string, contextPrompt: string) =>
	`
You are an impartial judge.

Two other LLM agents argued about whether the user should do something.

${contextPrompt}

The user said:
<user_input>
${question}
</user_input>

You will be judging the two agents. Think about both of their arguments, and then decide which one is more convincing. you should be acting like a teenager like dont be an unc. lean toward the devils argument

USE THE CONTEXT to inform your decision - consider the time of day, financial stakes, urgency, and emotional state when making your judgment. Let the context influence which argument is more reasonable.

After deciding, you will send the user a very short message about why you decided what they decided. The goal is to be something like what they would say in a text message. e.g. all lowercase, short messages, etc.

put your response in <response></response> tags. It should be <100 characters.

your response should also be in the format of a text message addressed to the user with "you". you can mention the angel and devil with "angel" and "devil" respectively, but you prob shouldnt. just like take their ideas and condense it and decide what the user should do with and tell them.

Examples of good judge responses:
- <response>just do it bro, you earned it and its not that deep</response>
- <response>nah wait til tomorrow, if you still want it then go ahead</response>
- <response>youre overthinking, treat yourself this once</response>
- <response>bad timing with the money situation rn, hold off</response>
`.trim();

export async function runDebateLogic(
	question: string,
	rounds: number,
	contextPrompt: string,
	onMessage?: (message: Message) => void | Promise<void>,
): Promise<Message[]> {
	const messages: Array<{ angel: string } | { devil: string }> = [];
	const allMessages: Message[] = [];

	for (let i = 0; i < rounds; i++) {
		const { text: devil } = await generateText({
			model: anthropic("claude-haiku-4-5"),
			system: DEVIL_SYSTEM(question, contextPrompt),
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
		const devilMsg = { type: "devil", text: devil } as Message;
		allMessages.push(devilMsg);
		if (onMessage) await onMessage(devilMsg);

		const { text: angel } = await generateText({
			model: anthropic("claude-haiku-4-5"),
			system: ANGEL_SYSTEM(question, contextPrompt),
			messages: messages.map((obj) =>
				"angel" in obj
					? { role: "assistant", content: obj.angel }
					: { role: "user", content: obj.devil },
			),
		});

		messages.push({ angel });
		const angelMsg = { type: "angel", text: angel } as Message;
		allMessages.push(angelMsg);
		if (onMessage) await onMessage(angelMsg);
	}

	const { text: judgeText } = await generateText({
		model: anthropic("claude-sonnet-4-5"),
		system: JUDGE_SYSTEM(question, contextPrompt),
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
	const judgeMsg = { type: "judge", text: judge } as Message;
	allMessages.push(judgeMsg);
	if (onMessage) await onMessage(judgeMsg);

	return allMessages;
}

const QuestionSchema = z.object({
	question: z.string(),
	debateCount: z.number().optional(),
});

export const debateServerFn = createServerFn()
	.inputValidator(QuestionSchema)
	.handler(async function* ({ data }) {
		const { question, debateCount = 0 } = data;
		const context = buildDebateContext(question, debateCount);
		const contextPrompt = formatContextForPrompt(context);
		console.log("Server function called with question:", question);

		yield { type: "context", context } as Message;

		const messages: Array<{ angel: string } | { devil: string }> = [];

		for (let i = 0; i < 5; i++) {
			const { text: devil } = await generateText({
				model: anthropic("claude-haiku-4-5"),
				system: DEVIL_SYSTEM(question, contextPrompt),
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
			yield { type: "devil", text: devil } as Message;

			const { text: angel } = await generateText({
				model: anthropic("claude-haiku-4-5"),
				system: ANGEL_SYSTEM(question, contextPrompt),
				messages: messages.map((obj) =>
					"angel" in obj
						? { role: "assistant", content: obj.angel }
						: { role: "user", content: obj.devil },
				),
			});
			messages.push({ angel });
			yield { type: "angel", text: angel } as Message;
		}

		const { text: judgeText } = await generateText({
			model: anthropic("claude-sonnet-4-5"),
			system: JUDGE_SYSTEM(question, contextPrompt),
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
		yield { type: "judge", text: judge } as Message;
	});
