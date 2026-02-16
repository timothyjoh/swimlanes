import type { APIRoute } from 'astro';
import { getDb } from '../../../db/init';
import { CardRepository } from '../../../repositories/CardRepository';

const VALID_COLORS = ['red', 'blue', 'green', 'yellow', 'purple', 'gray'];

export const GET: APIRoute = async ({ url }) => {
  const columnId = url.searchParams.get('columnId');

  if (!columnId) {
    return new Response(
      JSON.stringify({ error: 'columnId query parameter is required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const id = parseInt(columnId, 10);
  if (isNaN(id)) {
    return new Response(
      JSON.stringify({ error: 'Invalid columnId' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const db = getDb();
    const repo = new CardRepository(db);
    const cards = repo.findByColumnId(id);

    return new Response(
      JSON.stringify({ data: cards }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching cards:', error);
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

  // Validate columnId
  if (!body.columnId || typeof body.columnId !== 'number') {
    return new Response(
      JSON.stringify({ error: 'columnId is required and must be a number' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Validate title
  if (!body.title || typeof body.title !== 'string' || body.title.trim() === '') {
    return new Response(
      JSON.stringify({ error: 'title is required and must be a non-empty string' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Validate description (optional)
  const description = body.description === undefined || body.description === null ? null : body.description;
  if (description !== null && typeof description !== 'string') {
    return new Response(
      JSON.stringify({ error: 'description must be a string or null' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Validate color (optional)
  const color = body.color === undefined || body.color === null ? null : body.color;
  if (color !== null && (typeof color !== 'string' || !VALID_COLORS.includes(color))) {
    return new Response(
      JSON.stringify({ error: `color must be one of: ${VALID_COLORS.join(', ')}, or null` }),
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
    const card = repo.create(body.columnId, body.title.trim(), description, color, body.position);

    return new Response(
      JSON.stringify({ data: card }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error creating card:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
