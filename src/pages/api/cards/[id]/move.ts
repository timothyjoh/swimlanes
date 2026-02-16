import type { APIRoute } from 'astro';
import { getDb } from '../../../../db/init';
import { CardRepository } from '../../../../repositories/CardRepository';

export const PUT: APIRoute = async ({ params, request }) => {
  const id = parseInt(params.id || '', 10);

  if (isNaN(id)) {
    return new Response(
      JSON.stringify({ error: 'Invalid card ID' }),
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

  // Validate columnId
  if (!body.columnId || typeof body.columnId !== 'number') {
    return new Response(
      JSON.stringify({ error: 'columnId is required and must be a number' }),
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
    const repo = new CardRepository(db);
    const card = repo.move(id, body.columnId, body.position);

    if (!card) {
      return new Response(
        JSON.stringify({ error: 'Card not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ data: card }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error moving card:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
