import type { APIRoute } from "astro";
import { createColumn, listColumnsByBoard } from "../../../lib/db/columns";

export const POST: APIRoute = async ({ request }) => {
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (typeof body.boardId !== "number") {
    return new Response(
      JSON.stringify({ error: "boardId is required and must be a number" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
    return new Response(
      JSON.stringify({ error: "name is required and must be a string" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  try {
    const column = createColumn(body.boardId, body.name);
    return new Response(JSON.stringify(column), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("not found")) {
      return new Response(JSON.stringify({ error: message }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const GET: APIRoute = async ({ url }) => {
  const boardId = url.searchParams.get("boardId");

  if (!boardId) {
    return new Response(
      JSON.stringify({ error: "boardId query parameter is required" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const boardIdNum = parseInt(boardId, 10);
  if (isNaN(boardIdNum)) {
    return new Response(
      JSON.stringify({ error: "boardId must be a valid number" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const columns = listColumnsByBoard(boardIdNum);
  return new Response(JSON.stringify(columns), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
