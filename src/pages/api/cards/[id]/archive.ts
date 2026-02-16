import type { APIRoute } from "astro";
import { archiveCard } from "../../../../lib/db/cards";

export const POST: APIRoute = async ({ params }) => {
  try {
    const id = parseInt(params.id || "");
    if (isNaN(id)) {
      return new Response(JSON.stringify({ error: "Invalid card ID" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const card = archiveCard(id);
    if (!card) {
      return new Response(JSON.stringify({ error: "Card not found or already archived" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(card), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Archive card error:", error);
    return new Response(JSON.stringify({ error: "Failed to archive card" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
