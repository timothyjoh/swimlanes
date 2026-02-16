import type { APIRoute } from "astro";
import { updateCard, deleteCard } from "../../../lib/db/cards";

export const PATCH: APIRoute = async ({ params, request }) => {
  const id = Number(params.id);
  if (isNaN(id)) {
    return new Response(JSON.stringify({ error: "Invalid card ID" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const card = updateCard(id, {
      title: body.title,
      description: body.description,
      color: body.color,
    });
    if (!card) {
      return new Response(
        JSON.stringify({ error: `Card ${id} not found` }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify(card), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const DELETE: APIRoute = async ({ params }) => {
  const id = Number(params.id);
  if (isNaN(id)) {
    return new Response(JSON.stringify({ error: "Invalid card ID" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const deleted = deleteCard(id);
  if (!deleted) {
    return new Response(
      JSON.stringify({ error: `Card ${id} not found` }),
      {
        status: 404,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  return new Response(null, { status: 204 });
};
