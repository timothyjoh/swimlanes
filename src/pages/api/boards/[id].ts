import type { APIRoute } from 'astro';
import { getDb } from '@/lib/db/connection';
import { BoardRepository } from '@/lib/repositories/BoardRepository';

// GET /api/boards/:id - get a single board
export const GET: APIRoute = async ({ params }) => {
  const id = parseInt(params.id || '', 10);

  if (isNaN(id)) {
    return new Response(
      JSON.stringify({ error: 'Invalid board id' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const db = getDb();
  const repo = new BoardRepository(db);
  const board = repo.findById(id);

  if (!board) {
    return new Response(
      JSON.stringify({ error: 'Board not found' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return new Response(JSON.stringify(board), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
