import type { APIRoute } from 'astro';
import { getDb } from '@/lib/db/connection';
import { ColumnRepository } from '@/lib/repositories/ColumnRepository';

// PATCH /api/columns/:id - Update column name or position
export const PATCH: APIRoute = async ({ params, request }) => {
  try {
    const id = parseInt(params.id || '', 10);
    if (isNaN(id)) {
      return new Response(JSON.stringify({ error: 'Invalid column ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const db = getDb();
    const columnRepo = new ColumnRepository(db);

    const updates: any = {};
    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || body.name.trim() === '') {
        return new Response(JSON.stringify({ error: 'Column name must be a non-empty string' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      updates.name = body.name.trim();
    }
    if (body.position !== undefined) {
      if (typeof body.position !== 'number' || body.position < 1) {
        return new Response(JSON.stringify({ error: 'Position must be a positive integer' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      updates.position = body.position;
    }

    const column = columnRepo.update(id, updates);
    if (!column) {
      return new Response(JSON.stringify({ error: 'Column not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(column), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error updating column:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

// DELETE /api/columns/:id - Delete a column
export const DELETE: APIRoute = async ({ params }) => {
  try {
    const id = parseInt(params.id || '', 10);
    if (isNaN(id)) {
      return new Response(JSON.stringify({ error: 'Invalid column ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const db = getDb();
    const columnRepo = new ColumnRepository(db);

    const deleted = columnRepo.delete(id);
    if (!deleted) {
      return new Response(JSON.stringify({ error: 'Column not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error('Error deleting column:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
