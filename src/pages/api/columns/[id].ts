import type { APIRoute } from "astro";
import { renameColumn, deleteColumn } from "../../../lib/db/columns";

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

  if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
    return new Response(
      JSON.stringify({ error: "name is required and must be a string" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const column = renameColumn(id, body.name);
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

export const DELETE: APIRoute = async ({ params }) => {
  const id = Number(params.id);
  if (isNaN(id)) {
    return new Response(JSON.stringify({ error: "Invalid column ID" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const deleted = deleteColumn(id);
  if (!deleted) {
    return new Response(
      JSON.stringify({ error: `Column ${id} not found` }),
      {
        status: 404,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  return new Response(null, { status: 204 });
};
