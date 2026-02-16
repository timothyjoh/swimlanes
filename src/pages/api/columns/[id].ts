import type { APIRoute } from 'astro';
import { getDb } from '../../../db/init';
import { ColumnRepository } from '../../../repositories/ColumnRepository';

export const GET: APIRoute = async ({ params }) => {
  const id = parseInt(params.id || '', 10);

  if (isNaN(id)) {
    return new Response(
      JSON.stringify({ error: 'Invalid column ID' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const db = getDb();
    const repo = new ColumnRepository(db);
    const column = repo.findById(id);

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
    console.error('Error fetching column:', error);
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

  // Validate name
  if (!body.name || typeof body.name !== 'string' || body.name.trim() === '') {
    return new Response(
      JSON.stringify({ error: 'name is required and must be a non-empty string' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const db = getDb();
    const repo = new ColumnRepository(db);
    const column = repo.update(id, body.name.trim());

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
    console.error('Error updating column:', error);
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
      JSON.stringify({ error: 'Invalid column ID' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const db = getDb();
    const repo = new ColumnRepository(db);
    const success = repo.delete(id);

    if (!success) {
      return new Response(
        JSON.stringify({ error: 'Column not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error('Error deleting column:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
