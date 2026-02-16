import type { APIRoute } from "astro";
import { updateCardPosition } from "../../../../lib/db/cards";

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

  if (typeof body.position !== "number") {
    return new Response(
      JSON.stringify({
        error: "position is required and must be a number",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const card = updateCardPosition(id, body.position);
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
};
