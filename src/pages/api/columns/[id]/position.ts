import type { APIRoute } from "astro";
import { updateColumnPosition } from "../../../../lib/db/columns";

export const PATCH: APIRoute = async ({ params, request }) => {
  const id = Number(params.id);
  if (isNaN(id)) {
    return new Response(JSON.stringify({ error: "Invalid column ID" }), {
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

  const column = updateColumnPosition(id, body.position);
  if (!column) {
    return new Response(
      JSON.stringify({ error: `Column ${id} not found` }),
      {
        status: 404,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  return new Response(JSON.stringify(column), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
