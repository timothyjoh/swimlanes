import type { APIRoute } from "astro";
import { createCard, listCardsByColumn } from "../../../lib/db/cards";

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

  if (typeof body.columnId !== "number") {
    return new Response(
      JSON.stringify({ error: "columnId is required and must be a number" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  if (!body.title || typeof body.title !== "string" || !body.title.trim()) {
    return new Response(
      JSON.stringify({ error: "title is required and must be a string" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  try {
    const card = createCard(body.columnId, body.title, body.description, body.color);
    return new Response(JSON.stringify(card), {
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
  const columnId = url.searchParams.get("columnId");

  if (!columnId) {
    return new Response(
      JSON.stringify({ error: "columnId query parameter is required" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const columnIdNum = parseInt(columnId, 10);
  if (isNaN(columnIdNum)) {
    return new Response(
      JSON.stringify({ error: "columnId must be a valid number" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const cards = listCardsByColumn(columnIdNum);
  return new Response(JSON.stringify(cards), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
