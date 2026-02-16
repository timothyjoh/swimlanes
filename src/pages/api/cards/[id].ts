import type { APIRoute } from 'astro';
import { getDb } from '../../../db/init';
import { CardRepository } from '../../../repositories/CardRepository';

const VALID_COLORS = ['red', 'blue', 'green', 'yellow', 'purple', 'gray'];

export const GET: APIRoute = async ({ params }) => {
  const id = parseInt(params.id || '', 10);

  if (isNaN(id)) {
    return new Response(
      JSON.stringify({ error: 'Invalid card ID' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const db = getDb();
    const repo = new CardRepository(db);
    const card = repo.findById(id);

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
    console.error('Error fetching card:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

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

  // Check that at least one field is provided
  if (!body.title && body.description === undefined && body.color === undefined) {
    return new Response(
      JSON.stringify({ error: 'At least one field (title, description, or color) must be provided' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Validate title if provided
  if (body.title !== undefined && (typeof body.title !== 'string' || body.title.trim() === '')) {
    return new Response(
      JSON.stringify({ error: 'title must be a non-empty string' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Validate description if provided
  if (body.description !== undefined && body.description !== null && typeof body.description !== 'string') {
    return new Response(
      JSON.stringify({ error: 'description must be a string or null' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Validate color if provided
  if (body.color !== undefined && body.color !== null && (typeof body.color !== 'string' || !VALID_COLORS.includes(body.color))) {
    return new Response(
      JSON.stringify({ error: `color must be one of: ${VALID_COLORS.join(', ')}, or null` }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const db = getDb();
    const repo = new CardRepository(db);

    // Prepare update object
    const updates: { title?: string; description?: string | null; color?: string | null } = {};
    if (body.title !== undefined) updates.title = body.title.trim();
    if (body.description !== undefined) updates.description = body.description;
    if (body.color !== undefined) updates.color = body.color;

    const card = repo.update(id, updates);

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
    console.error('Error updating card:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const DELETE: APIRoute = async ({ params }) => {
  const id = parseInt(params.id || '', 10);

  if (isNaN(id)) {
    return new Response(
      JSON.stringify({ error: 'Invalid card ID' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const db = getDb();
    const repo = new CardRepository(db);
    const success = repo.delete(id);

    if (!success) {
      return new Response(
        JSON.stringify({ error: 'Card not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error('Error deleting card:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
