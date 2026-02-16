import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { unlinkSync } from "node:fs";
import { getDb, closeDb } from "../../../../lib/db/connection";
import { createBoard } from "../../../../lib/db/boards";
import { createColumn } from "../../../../lib/db/columns";
import { GET, POST } from "../index";
import { PATCH, DELETE } from "../[id]";
import { PATCH as PATCH_POSITION } from "../[id]/position";
import { PATCH as PATCH_COLUMN } from "../[id]/column";

let tempDbPath: string;

function createContext(
  request: Request,
  params: Record<string, string> = {}
): any {
  const url = new URL(request.url);
  return { request, params, url };
}

function jsonRequest(
  url: string,
  method: string,
  body?: Record<string, unknown>
): Request {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

let boardId: number;
let columnId: number;

beforeEach(() => {
  closeDb();
  tempDbPath = join(
    tmpdir(),
    `test-card-api-${Date.now()}-${Math.random().toString(36).slice(2)}.db`
  );
  getDb(tempDbPath);
  const board = createBoard("Test Board");
  boardId = board.id;
  const column = createColumn(board.id, "To Do");
  columnId = column.id;
});

afterEach(() => {
  closeDb();
  try { unlinkSync(tempDbPath); } catch {}
  try { unlinkSync(tempDbPath + "-wal"); } catch {}
  try { unlinkSync(tempDbPath + "-shm"); } catch {}
});

describe("POST /api/cards", () => {
  it("returns 201 with created card (title only)", async () => {
    const res = await POST(
      createContext(
        jsonRequest("http://localhost/api/cards", "POST", {
          columnId,
          title: "New Task",
        })
      )
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.title).toBe("New Task");
    expect(data.column_id).toBe(columnId);
    expect(data.position).toBe(1000);
    expect(data.id).toBeTypeOf("number");
  });

  it("returns 201 with created card (all fields)", async () => {
    const res = await POST(
      createContext(
        jsonRequest("http://localhost/api/cards", "POST", {
          columnId,
          title: "Full Card",
          description: "A description",
          color: "blue",
        })
      )
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.title).toBe("Full Card");
    expect(data.description).toBe("A description");
    expect(data.color).toBe("blue");
  });

  it("returns 400 when columnId missing", async () => {
    const res = await POST(
      createContext(
        jsonRequest("http://localhost/api/cards", "POST", { title: "Test" })
      )
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("columnId");
  });

  it("returns 400 when title missing", async () => {
    const res = await POST(
      createContext(
        jsonRequest("http://localhost/api/cards", "POST", { columnId })
      )
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("title");
  });

  it("returns 400 when columnId is not a number", async () => {
    const res = await POST(
      createContext(
        jsonRequest("http://localhost/api/cards", "POST", {
          columnId: "abc" as unknown as number,
          title: "Test",
        })
      )
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 when column does not exist", async () => {
    const res = await POST(
      createContext(
        jsonRequest("http://localhost/api/cards", "POST", {
          columnId: 99999,
          title: "Test",
        })
      )
    );
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toContain("not found");
  });

  it("returns 400 for malformed JSON", async () => {
    const req = new Request("http://localhost/api/cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{invalid json",
    });
    const res = await POST(createContext(req));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Invalid JSON");
  });

  it("returns 400 when title is empty string", async () => {
    const res = await POST(
      createContext(
        jsonRequest("http://localhost/api/cards", "POST", {
          columnId,
          title: "",
        })
      )
    );
    expect(res.status).toBe(400);
  });
});

describe("GET /api/cards", () => {
  it("returns 200 with cards array", async () => {
    await POST(
      createContext(
        jsonRequest("http://localhost/api/cards", "POST", {
          columnId,
          title: "Card 1",
        })
      )
    );

    const req = new Request(`http://localhost/api/cards?columnId=${columnId}`);
    const res = await GET(createContext(req));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].title).toBe("Card 1");
  });

  it("returns 200 with empty array for column with no cards", async () => {
    const req = new Request(`http://localhost/api/cards?columnId=${columnId}`);
    const res = await GET(createContext(req));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual([]);
  });

  it("returns 400 when columnId missing", async () => {
    const req = new Request("http://localhost/api/cards");
    const res = await GET(createContext(req));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("columnId");
  });

  it("returns 400 when columnId is not a number", async () => {
    const req = new Request("http://localhost/api/cards?columnId=abc");
    const res = await GET(createContext(req));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("columnId");
  });
});

describe("PATCH /api/cards/:id", () => {
  it("returns 200 when updating title", async () => {
    const createRes = await POST(
      createContext(
        jsonRequest("http://localhost/api/cards", "POST", {
          columnId,
          title: "Old Title",
        })
      )
    );
    const card = await createRes.json();

    const res = await PATCH(
      createContext(
        jsonRequest(`http://localhost/api/cards/${card.id}`, "PATCH", {
          title: "New Title",
        }),
        { id: String(card.id) }
      )
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.title).toBe("New Title");
  });

  it("returns 200 when updating description", async () => {
    const createRes = await POST(
      createContext(
        jsonRequest("http://localhost/api/cards", "POST", {
          columnId,
          title: "Task",
        })
      )
    );
    const card = await createRes.json();

    const res = await PATCH(
      createContext(
        jsonRequest(`http://localhost/api/cards/${card.id}`, "PATCH", {
          description: "New description",
        }),
        { id: String(card.id) }
      )
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.description).toBe("New description");
  });

  it("returns 200 when updating color", async () => {
    const createRes = await POST(
      createContext(
        jsonRequest("http://localhost/api/cards", "POST", {
          columnId,
          title: "Task",
        })
      )
    );
    const card = await createRes.json();

    const res = await PATCH(
      createContext(
        jsonRequest(`http://localhost/api/cards/${card.id}`, "PATCH", {
          color: "red",
        }),
        { id: String(card.id) }
      )
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.color).toBe("red");
  });

  it("returns 200 when updating multiple fields", async () => {
    const createRes = await POST(
      createContext(
        jsonRequest("http://localhost/api/cards", "POST", {
          columnId,
          title: "Task",
        })
      )
    );
    const card = await createRes.json();

    const res = await PATCH(
      createContext(
        jsonRequest(`http://localhost/api/cards/${card.id}`, "PATCH", {
          title: "Updated",
          description: "Desc",
          color: "green",
        }),
        { id: String(card.id) }
      )
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.title).toBe("Updated");
    expect(data.description).toBe("Desc");
    expect(data.color).toBe("green");
  });

  it("returns 400 when title is empty", async () => {
    const createRes = await POST(
      createContext(
        jsonRequest("http://localhost/api/cards", "POST", {
          columnId,
          title: "Task",
        })
      )
    );
    const card = await createRes.json();

    const res = await PATCH(
      createContext(
        jsonRequest(`http://localhost/api/cards/${card.id}`, "PATCH", {
          title: "",
        }),
        { id: String(card.id) }
      )
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 for non-existent card ID", async () => {
    const res = await PATCH(
      createContext(
        jsonRequest("http://localhost/api/cards/99999", "PATCH", {
          title: "Nope",
        }),
        { id: "99999" }
      )
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 for invalid ID format", async () => {
    const res = await PATCH(
      createContext(
        jsonRequest("http://localhost/api/cards/abc", "PATCH", {
          title: "Test",
        }),
        { id: "abc" }
      )
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for malformed JSON", async () => {
    const req = new Request("http://localhost/api/cards/1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: "{invalid json",
    });
    const res = await PATCH(createContext(req, { id: "1" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Invalid JSON");
  });
});

describe("DELETE /api/cards/:id", () => {
  it("returns 204 on success", async () => {
    const createRes = await POST(
      createContext(
        jsonRequest("http://localhost/api/cards", "POST", {
          columnId,
          title: "Delete Me",
        })
      )
    );
    const card = await createRes.json();

    const res = await DELETE(
      createContext(
        new Request(`http://localhost/api/cards/${card.id}`, {
          method: "DELETE",
        }),
        { id: String(card.id) }
      )
    );
    expect(res.status).toBe(204);
  });

  it("returns 404 when card not found", async () => {
    const res = await DELETE(
      createContext(
        new Request("http://localhost/api/cards/99999", {
          method: "DELETE",
        }),
        { id: "99999" }
      )
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 for invalid ID format", async () => {
    const res = await DELETE(
      createContext(
        new Request("http://localhost/api/cards/abc", {
          method: "DELETE",
        }),
        { id: "abc" }
      )
    );
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/cards/:id/position", () => {
  it("returns 200 with updated card", async () => {
    const createRes = await POST(
      createContext(
        jsonRequest("http://localhost/api/cards", "POST", {
          columnId,
          title: "Movable",
        })
      )
    );
    const card = await createRes.json();

    const res = await PATCH_POSITION(
      createContext(
        jsonRequest(
          `http://localhost/api/cards/${card.id}/position`,
          "PATCH",
          { position: 500 }
        ),
        { id: String(card.id) }
      )
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.position).toBe(500);
  });

  it("returns 400 when position missing", async () => {
    const res = await PATCH_POSITION(
      createContext(
        jsonRequest("http://localhost/api/cards/1/position", "PATCH", {}),
        { id: "1" }
      )
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("position");
  });

  it("returns 400 when position is not a number", async () => {
    const res = await PATCH_POSITION(
      createContext(
        jsonRequest("http://localhost/api/cards/1/position", "PATCH", {
          position: "abc" as unknown as number,
        }),
        { id: "1" }
      )
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 when card not found", async () => {
    const res = await PATCH_POSITION(
      createContext(
        jsonRequest(
          "http://localhost/api/cards/99999/position",
          "PATCH",
          { position: 500 }
        ),
        { id: "99999" }
      )
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 for invalid ID format", async () => {
    const res = await PATCH_POSITION(
      createContext(
        jsonRequest("http://localhost/api/cards/abc/position", "PATCH", {
          position: 500,
        }),
        { id: "abc" }
      )
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for malformed JSON", async () => {
    const req = new Request("http://localhost/api/cards/1/position", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: "{invalid json",
    });
    const res = await PATCH_POSITION(createContext(req, { id: "1" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Invalid JSON");
  });
});

describe("PATCH /api/cards/:id/column", () => {
  it("returns 200 when moving card to different column", async () => {
    const col2 = createColumn(boardId, "In Progress");

    const createRes = await POST(
      createContext(
        jsonRequest("http://localhost/api/cards", "POST", {
          columnId,
          title: "Move Me",
        })
      )
    );
    const card = await createRes.json();

    const res = await PATCH_COLUMN(
      createContext(
        jsonRequest(
          `http://localhost/api/cards/${card.id}/column`,
          "PATCH",
          { columnId: col2.id, position: 1000 }
        ),
        { id: String(card.id) }
      )
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.column_id).toBe(col2.id);
    expect(data.position).toBe(1000);
  });

  it("returns 400 when columnId missing", async () => {
    const res = await PATCH_COLUMN(
      createContext(
        jsonRequest("http://localhost/api/cards/1/column", "PATCH", {
          position: 1000,
        }),
        { id: "1" }
      )
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("columnId");
  });

  it("returns 400 when position missing", async () => {
    const res = await PATCH_COLUMN(
      createContext(
        jsonRequest("http://localhost/api/cards/1/column", "PATCH", {
          columnId: 1,
        }),
        { id: "1" }
      )
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("position");
  });

  it("returns 400 when columnId is not a number", async () => {
    const res = await PATCH_COLUMN(
      createContext(
        jsonRequest("http://localhost/api/cards/1/column", "PATCH", {
          columnId: "abc" as unknown as number,
          position: 1000,
        }),
        { id: "1" }
      )
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 when card not found", async () => {
    const res = await PATCH_COLUMN(
      createContext(
        jsonRequest(
          "http://localhost/api/cards/99999/column",
          "PATCH",
          { columnId, position: 1000 }
        ),
        { id: "99999" }
      )
    );
    expect(res.status).toBe(404);
  });

  it("returns 404 when target column not found", async () => {
    const createRes = await POST(
      createContext(
        jsonRequest("http://localhost/api/cards", "POST", {
          columnId,
          title: "Task",
        })
      )
    );
    const card = await createRes.json();

    const res = await PATCH_COLUMN(
      createContext(
        jsonRequest(
          `http://localhost/api/cards/${card.id}/column`,
          "PATCH",
          { columnId: 99999, position: 1000 }
        ),
        { id: String(card.id) }
      )
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 for invalid ID format", async () => {
    const res = await PATCH_COLUMN(
      createContext(
        jsonRequest("http://localhost/api/cards/abc/column", "PATCH", {
          columnId: 1,
          position: 1000,
        }),
        { id: "abc" }
      )
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for malformed JSON", async () => {
    const req = new Request("http://localhost/api/cards/1/column", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: "{invalid json",
    });
    const res = await PATCH_COLUMN(createContext(req, { id: "1" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Invalid JSON");
  });
});
