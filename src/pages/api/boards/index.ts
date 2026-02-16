import type { APIRoute } from 'astro';
import { getDb } from '../../../db/init';
import { BoardRepository } from '../../../repositories/BoardRepository';

// GET /api/boards - List all boards
export const GET: APIRoute = async () => {
  try {
    const db = getDb();
    const repo = new BoardRepository(db);
    const boards = repo.findAll();

    return new Response(JSON.stringify({ data: boards }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error in GET /api/boards:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

// POST /api/boards - Create new board
export const POST: APIRoute = async ({ request }) => {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!body.name || typeof body.name !== 'string' || body.name.trim() === '') {
      return new Response(
        JSON.stringify({ error: 'Board name is required and must be a non-empty string' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const db = getDb();
    const repo = new BoardRepository(db);
    const board = repo.create(body.name.trim());

    return new Response(JSON.stringify({ data: board }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error in POST /api/boards:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
