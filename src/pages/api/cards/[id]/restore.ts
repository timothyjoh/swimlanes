import type { APIRoute } from "astro";
import { restoreCard } from "../../../../lib/db/cards";

export const POST: APIRoute = async ({ params }) => {
  try {
    const id = parseInt(params.id || "");
    if (isNaN(id)) {
      return new Response(JSON.stringify({ error: "Invalid card ID" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const card = restoreCard(id);
    return new Response(JSON.stringify(card), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Restore card error:", error);

    if (error instanceof Error) {
      if (error.message === "Card not found") {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (error.message === "Card is not archived") {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ error: "Failed to restore card" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
