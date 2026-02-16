import type { APIRoute } from 'astro';
import { getDb } from '@/lib/db/connection';
import { ColumnRepository } from '@/lib/repositories/ColumnRepository';
import { BoardRepository } from '@/lib/repositories/BoardRepository';

// GET /api/boards/:boardId/columns - List all columns for a board
export const GET: APIRoute = async ({ params }) => {
  try {
    const boardId = parseInt(params.boardId || '', 10);
    if (isNaN(boardId)) {
      return new Response(JSON.stringify({ error: 'Invalid board ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const db = getDb();
    const boardRepo = new BoardRepository(db);
    const columnRepo = new ColumnRepository(db);

    // Check if board exists
    const board = boardRepo.findById(boardId);
    if (!board) {
      return new Response(JSON.stringify({ error: 'Board not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const columns = columnRepo.findByBoardId(boardId);
    return new Response(JSON.stringify(columns), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching columns:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

// POST /api/boards/:boardId/columns - Create a new column
export const POST: APIRoute = async ({ params, request }) => {
  try {
    const boardId = parseInt(params.boardId || '', 10);
    if (isNaN(boardId)) {
      return new Response(JSON.stringify({ error: 'Invalid board ID' }), {
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

    // Validation
    if (!body.name || typeof body.name !== 'string' || body.name.trim() === '') {
      return new Response(JSON.stringify({ error: 'Column name is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const db = getDb();
    const boardRepo = new BoardRepository(db);
    const columnRepo = new ColumnRepository(db);

    // Check if board exists
    const board = boardRepo.findById(boardId);
    if (!board) {
      return new Response(JSON.stringify({ error: 'Board not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Calculate position (append to end)
    const existingColumns = columnRepo.findByBoardId(boardId);
    const position = existingColumns.length > 0
      ? Math.max(...existingColumns.map(c => c.position)) + 1
      : 1;

    const newColumn = {
      board_id: boardId,
      name: body.name.trim(),
      position,
    };

    const column = columnRepo.create(newColumn);
    return new Response(JSON.stringify(column), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error creating column:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
