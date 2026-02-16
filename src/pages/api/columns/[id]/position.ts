import type { APIRoute } from "astro";
import { updateColumnPosition, rebalanceColumnPositions, getColumnById } from "../../../../lib/db/columns";

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

  // Check if rebalancing is needed after position update
  rebalanceColumnPositions(column.board_id);

  // Re-fetch column to get updated position if rebalancing occurred
  const updatedColumn = getColumnById(id);

  return new Response(JSON.stringify(updatedColumn), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
