import type { APIRoute } from "astro";
import { listArchivedCards } from "../../../lib/db/cards";

export const GET: APIRoute = async ({ url }) => {
  try {
    const boardId = parseInt(url.searchParams.get("boardId") || "");
    if (isNaN(boardId)) {
      return new Response(JSON.stringify({ error: "Invalid board ID" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const cards = listArchivedCards(boardId);
    return new Response(JSON.stringify(cards), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("List archived cards error:", error);
    return new Response(JSON.stringify({ error: "Failed to list archived cards" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
