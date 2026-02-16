import type { APIRoute } from 'astro';
import { getDb } from '@/lib/db/connection';
import { BoardRepository } from '@/lib/repositories/BoardRepository';

// GET /api/boards - list all boards
export const GET: APIRoute = async () => {
  const db = getDb();
  const repo = new BoardRepository(db);
  const boards = repo.findAll();

  return new Response(JSON.stringify(boards), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};

// POST /api/boards - create a board
export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();

    // Validation
    if (!body.name || typeof body.name !== 'string') {
      return new Response(
        JSON.stringify({ error: 'name is required and must be a string' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (body.name.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'name cannot be empty' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const db = getDb();
    const repo = new BoardRepository(db);
    const board = repo.create({ name: body.name.trim() });

    return new Response(JSON.stringify(board), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error creating board:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
