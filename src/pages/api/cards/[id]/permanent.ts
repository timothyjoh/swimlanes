import type { APIRoute } from "astro";
import { deleteCardPermanently } from "../../../../lib/db/cards";

export const DELETE: APIRoute = async ({ params }) => {
  try {
    const id = parseInt(params.id || "");
    if (isNaN(id)) {
      return new Response(JSON.stringify({ error: "Invalid card ID" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const success = deleteCardPermanently(id);
    if (!success) {
      return new Response(JSON.stringify({ error: "Card not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("Delete card permanently error:", error);
    return new Response(JSON.stringify({ error: "Failed to delete card" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
