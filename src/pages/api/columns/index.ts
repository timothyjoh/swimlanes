import type { APIRoute } from 'astro';
import { getDb } from '../../../db/init';
import { ColumnRepository } from '../../../repositories/ColumnRepository';

export const GET: APIRoute = async ({ url }) => {
  const boardId = url.searchParams.get('boardId');

  if (!boardId) {
    return new Response(
      JSON.stringify({ error: 'boardId query parameter is required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const id = parseInt(boardId, 10);
  if (isNaN(id)) {
    return new Response(
      JSON.stringify({ error: 'Invalid boardId' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const db = getDb();
    const repo = new ColumnRepository(db);
    const columns = repo.findByBoardId(id);

    return new Response(
      JSON.stringify({ data: columns }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching columns:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const POST: APIRoute = async ({ request }) => {
  let body: any;

  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Validate boardId
  if (!body.boardId || typeof body.boardId !== 'number') {
    return new Response(
      JSON.stringify({ error: 'boardId is required and must be a number' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Validate name
  if (!body.name || typeof body.name !== 'string' || body.name.trim() === '') {
    return new Response(
      JSON.stringify({ error: 'name is required and must be a non-empty string' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Validate position
  if (body.position === undefined || typeof body.position !== 'number' || body.position < 0) {
    return new Response(
      JSON.stringify({ error: 'position is required and must be a number >= 0' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const db = getDb();
    const repo = new ColumnRepository(db);
    const column = repo.create(body.boardId, body.name.trim(), body.position);

    return new Response(
      JSON.stringify({ data: column }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error creating column:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
