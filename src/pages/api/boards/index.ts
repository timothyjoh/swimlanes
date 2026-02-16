import type { APIRoute } from "astro";
import { createBoard, listBoards } from "../../../lib/db/boards";

export const GET: APIRoute = async () => {
  const boards = listBoards();
  return new Response(JSON.stringify(boards), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();
  const name = body?.name;

  if (!name || typeof name !== "string" || !name.trim()) {
    return new Response(JSON.stringify({ error: "Name is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const board = createBoard(name);
  return new Response(JSON.stringify(board), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
};
