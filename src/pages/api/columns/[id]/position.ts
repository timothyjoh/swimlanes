import type { APIRoute } from 'astro';
import { getDb } from '../../../../db/init';
import { ColumnRepository } from '../../../../repositories/ColumnRepository';

export const PUT: APIRoute = async ({ params, request }) => {
  const id = parseInt(params.id || '', 10);

  if (isNaN(id)) {
    return new Response(
      JSON.stringify({ error: 'Invalid column ID' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  let body: any;

  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
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
    const column = repo.updatePosition(id, body.position);

    if (!column) {
      return new Response(
        JSON.stringify({ error: 'Column not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ data: column }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error updating column position:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
