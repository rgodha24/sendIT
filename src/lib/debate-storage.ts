import { createServerFn } from "@tanstack/react-start";
import { db } from "./db";
import { z } from "zod";
import type { Message } from "./debate";
import type { DebateContext } from "./context";

export type DebateHistory = {
	id: string;
	question: string;
	messages: Message[];
	timestamp: number;
	isFavorite?: boolean;
	reaction?: "thumbs-up" | "thumbs-down";
	context?: DebateContext;
};

const SaveDebateSchema = z.object({
	id: z.string(),
	question: z.string(),
	messages: z.array(z.any()),
	timestamp: z.number(),
	context: z.any().optional(),
});

const UpdateDebateSchema = z.object({
	id: z.string(),
	isFavorite: z.boolean().optional(),
	reaction: z.enum(["thumbs-up", "thumbs-down"]).optional(),
});

const DeleteDebateSchema = z.object({
	id: z.string(),
});

const GetDebateSchema = z.object({
	id: z.string(),
});

const CreateDebateSchema = z.object({
	question: z.string(),
});

export const saveDebateFn = createServerFn()
	.inputValidator(SaveDebateSchema)
	.handler(async ({ data }) => {
		const stmt = db.prepare(`
      INSERT INTO debates (id, question, messages, timestamp, is_favorite, reaction, context)
      VALUES (?, ?, ?, ?, 0, NULL, ?)
    `);

		stmt.run(
			data.id,
			data.question,
			JSON.stringify(data.messages),
			data.timestamp,
			data.context ? JSON.stringify(data.context) : null,
		);

		return { success: true };
	});

export const createDebateFn = createServerFn()
	.inputValidator(CreateDebateSchema)
	.handler(async ({ data }) => {
		const debateId = `debate-${Date.now()}`;
		const timestamp = Date.now();

		const stmt = db.prepare(`
      INSERT INTO debates (id, question, messages, timestamp, is_favorite, reaction)
      VALUES (?, ?, ?, ?, 0, NULL)
    `);

		stmt.run(debateId, data.question, JSON.stringify([]), timestamp);

		return { debateId };
	});

export const appendMessageFn = createServerFn()
	.inputValidator(
		z.object({
			id: z.string(),
			message: z.any(),
		}),
	)
	.handler(async ({ data }) => {
		const getStmt = db.prepare(`
			SELECT messages FROM debates WHERE id = ?
		`);
		const row = getStmt.get(data.id) as { messages: string } | undefined;

		if (!row) {
			throw new Error("Debate not found");
		}

		const messages = JSON.parse(row.messages);
		messages.push(data.message);

		const updateStmt = db.prepare(`
			UPDATE debates SET messages = ? WHERE id = ?
		`);
		updateStmt.run(JSON.stringify(messages), data.id);

		return { success: true };
	});

export const getDebatesFn = createServerFn().handler(async () => {
	const stmt = db.prepare(`
    SELECT id, question, messages, timestamp, is_favorite, reaction, context
    FROM debates
    ORDER BY timestamp DESC
    LIMIT 50
  `);

	const rows = stmt.all() as Array<{
		id: string;
		question: string;
		messages: string;
		timestamp: number;
		is_favorite: number;
		reaction: string | null;
		context: string | null;
	}>;

	return rows.map((row) => ({
		id: row.id,
		question: row.question,
		messages: JSON.parse(row.messages),
		timestamp: row.timestamp,
		isFavorite: row.is_favorite === 1,
		reaction: row.reaction as "thumbs-up" | "thumbs-down" | undefined,
		context: row.context ? JSON.parse(row.context) : undefined,
	})) as DebateHistory[];
});

export const getDebateFn = createServerFn()
	.inputValidator(GetDebateSchema)
	.handler(async ({ data }) => {
		const stmt = db.prepare(`
      SELECT id, question, messages, timestamp, is_favorite, reaction, context
      FROM debates
      WHERE id = ?
    `);

		const row = stmt.get(data.id) as
			| {
					id: string;
					question: string;
					messages: string;
					timestamp: number;
					is_favorite: number;
					reaction: string | null;
					context: string | null;
			  }
			| undefined;

		if (!row) {
			return null;
		}

		return {
			id: row.id,
			question: row.question,
			messages: JSON.parse(row.messages),
			timestamp: row.timestamp,
			isFavorite: row.is_favorite === 1,
			reaction: row.reaction as "thumbs-up" | "thumbs-down" | undefined,
			context: row.context ? JSON.parse(row.context) : undefined,
		} as DebateHistory;
	});

export const updateDebateFn = createServerFn()
	.inputValidator(UpdateDebateSchema)
	.handler(async ({ data }) => {
		const updates: string[] = [];
		const values: Array<string | number> = [];

		if (data.isFavorite !== undefined) {
			updates.push("is_favorite = ?");
			values.push(data.isFavorite ? 1 : 0);
		}

		if (data.reaction !== undefined) {
			updates.push("reaction = ?");
			values.push(data.reaction);
		}

		if (updates.length === 0) {
			return { success: true };
		}

		values.push(data.id);

		const stmt = db.prepare(`
      UPDATE debates
      SET ${updates.join(", ")}
      WHERE id = ?
    `);

		stmt.run(...values);

		return { success: true };
	});

export const deleteDebateFn = createServerFn()
	.inputValidator(DeleteDebateSchema)
	.handler(async ({ data }) => {
		const stmt = db.prepare("DELETE FROM debates WHERE id = ?");
		stmt.run(data.id);
		return { success: true };
	});
