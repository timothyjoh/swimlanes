import type { APIRoute } from 'astro';
import { getDb } from '../../../db/init';
import { BoardRepository } from '../../../repositories/BoardRepository';

// GET /api/boards/:id - Get board with columns and cards
export const GET: APIRoute = async ({ params }) => {
  try {
    const id = parseInt(params.id || '', 10);
    if (isNaN(id)) {
      return new Response(
        JSON.stringify({ error: 'Invalid board ID' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const db = getDb();
    const repo = new BoardRepository(db);
    const board = repo.findByIdWithColumns(id);

    if (!board) {
      return new Response(
        JSON.stringify({ error: 'Board not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({ data: board }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error in GET /api/boards/:id:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

// PUT /api/boards/:id - Update board name
export const PUT: APIRoute = async ({ params, request }) => {
  try {
    const id = parseInt(params.id || '', 10);
    if (isNaN(id)) {
      return new Response(
        JSON.stringify({ error: 'Invalid board ID' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

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
    const board = repo.update(id, body.name.trim());

    if (!board) {
      return new Response(
        JSON.stringify({ error: 'Board not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({ data: board }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error in PUT /api/boards/:id:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

// DELETE /api/boards/:id - Delete board
export const DELETE: APIRoute = async ({ params }) => {
  try {
    const id = parseInt(params.id || '', 10);
    if (isNaN(id)) {
      return new Response(
        JSON.stringify({ error: 'Invalid board ID' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const db = getDb();
    const repo = new BoardRepository(db);
    const deleted = repo.delete(id);

    if (!deleted) {
      return new Response(
        JSON.stringify({ error: 'Board not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error('Error in DELETE /api/boards/:id:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
