import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { unlinkSync } from "node:fs";
import { getDb, closeDb } from "../../../../lib/db/connection";
import { createBoard } from "../../../../lib/db/boards";
import { createColumn, listColumnsByBoard, updateColumnPosition } from "../../../../lib/db/columns";
import { GET, POST } from "../index";
import { PATCH, DELETE } from "../[id]";
import { PATCH as PATCH_POSITION } from "../[id]/position";

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

beforeEach(() => {
  closeDb();
  tempDbPath = join(
    tmpdir(),
    `test-col-api-${Date.now()}-${Math.random().toString(36).slice(2)}.db`
  );
  getDb(tempDbPath);
});

afterEach(() => {
  closeDb();
  try { unlinkSync(tempDbPath); } catch {}
  try { unlinkSync(tempDbPath + "-wal"); } catch {}
  try { unlinkSync(tempDbPath + "-shm"); } catch {}
});

describe("POST /api/columns", () => {
  it("returns 201 with created column", async () => {
    const board = createBoard("Test Board");
    const res = await POST(
      createContext(
        jsonRequest("http://localhost/api/columns", "POST", {
          boardId: board.id,
          name: "To Do",
        })
      )
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.name).toBe("To Do");
    expect(data.board_id).toBe(board.id);
    expect(data.position).toBe(1000);
    expect(data.id).toBeTypeOf("number");
  });

  it("returns 400 when boardId missing", async () => {
    const res = await POST(
      createContext(
        jsonRequest("http://localhost/api/columns", "POST", { name: "Test" })
      )
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("boardId");
  });

  it("returns 400 when name missing", async () => {
    const res = await POST(
      createContext(
        jsonRequest("http://localhost/api/columns", "POST", { boardId: 1 })
      )
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("name");
  });

  it("returns 400 when boardId is not a number", async () => {
    const res = await POST(
      createContext(
        jsonRequest("http://localhost/api/columns", "POST", {
          boardId: "abc" as unknown as number,
          name: "Test",
        })
      )
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 when board does not exist", async () => {
    const res = await POST(
      createContext(
        jsonRequest("http://localhost/api/columns", "POST", {
          boardId: 99999,
          name: "Test",
        })
      )
    );
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toContain("not found");
  });

  it("returns 400 for malformed JSON", async () => {
    const req = new Request("http://localhost/api/columns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{invalid json",
    });
    const res = await POST(createContext(req));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Invalid JSON");
  });

  it("returns 400 when name is empty string", async () => {
    const board = createBoard("Test Board");
    const res = await POST(
      createContext(
        jsonRequest("http://localhost/api/columns", "POST", {
          boardId: board.id,
          name: "",
        })
      )
    );
    expect(res.status).toBe(400);
  });
});

describe("GET /api/columns", () => {
  it("returns 200 with columns array", async () => {
    const board = createBoard("Test Board");
    await POST(
      createContext(
        jsonRequest("http://localhost/api/columns", "POST", {
          boardId: board.id,
          name: "Col 1",
        })
      )
    );

    const req = new Request(
      `http://localhost/api/columns?boardId=${board.id}`
    );
    const res = await GET(createContext(req));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].name).toBe("Col 1");
  });

  it("returns 400 when boardId missing", async () => {
    const req = new Request("http://localhost/api/columns");
    const res = await GET(createContext(req));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("boardId");
  });

  it("returns 400 when boardId is not a number", async () => {
    const req = new Request("http://localhost/api/columns?boardId=abc");
    const res = await GET(createContext(req));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("boardId");
  });

  it("returns 200 with empty array for non-existent board", async () => {
    const req = new Request("http://localhost/api/columns?boardId=99999");
    const res = await GET(createContext(req));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual([]);
  });
});

describe("PATCH /api/columns/:id", () => {
  it("returns 200 with updated column", async () => {
    const board = createBoard("Test Board");
    const createRes = await POST(
      createContext(
        jsonRequest("http://localhost/api/columns", "POST", {
          boardId: board.id,
          name: "Old Name",
        })
      )
    );
    const column = await createRes.json();

    const res = await PATCH(
      createContext(
        jsonRequest(`http://localhost/api/columns/${column.id}`, "PATCH", {
          name: "New Name",
        }),
        { id: String(column.id) }
      )
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.name).toBe("New Name");
  });

  it("returns 400 when name missing", async () => {
    const res = await PATCH(
      createContext(
        jsonRequest("http://localhost/api/columns/1", "PATCH", {}),
        { id: "1" }
      )
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 when column not found", async () => {
    const res = await PATCH(
      createContext(
        jsonRequest("http://localhost/api/columns/99999", "PATCH", {
          name: "Nope",
        }),
        { id: "99999" }
      )
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 for invalid ID format", async () => {
    const res = await PATCH(
      createContext(
        jsonRequest("http://localhost/api/columns/abc", "PATCH", {
          name: "Test",
        }),
        { id: "abc" }
      )
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for malformed JSON", async () => {
    const req = new Request("http://localhost/api/columns/1", {
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

describe("DELETE /api/columns/:id", () => {
  it("returns 204 on success", async () => {
    const board = createBoard("Test Board");
    const createRes = await POST(
      createContext(
        jsonRequest("http://localhost/api/columns", "POST", {
          boardId: board.id,
          name: "Delete Me",
        })
      )
    );
    const column = await createRes.json();

    const res = await DELETE(
      createContext(
        new Request(`http://localhost/api/columns/${column.id}`, {
          method: "DELETE",
        }),
        { id: String(column.id) }
      )
    );
    expect(res.status).toBe(204);
  });

  it("returns 404 when column not found", async () => {
    const res = await DELETE(
      createContext(
        new Request("http://localhost/api/columns/99999", {
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
        new Request("http://localhost/api/columns/abc", {
          method: "DELETE",
        }),
        { id: "abc" }
      )
    );
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/columns/:id/position", () => {
  it("returns 200 with updated column", async () => {
    const board = createBoard("Test Board");
    const createRes = await POST(
      createContext(
        jsonRequest("http://localhost/api/columns", "POST", {
          boardId: board.id,
          name: "Movable",
        })
      )
    );
    const column = await createRes.json();

    const res = await PATCH_POSITION(
      createContext(
        jsonRequest(
          `http://localhost/api/columns/${column.id}/position`,
          "PATCH",
          { position: 500 }
        ),
        { id: String(column.id) }
      )
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.position).toBe(500);
  });

  it("returns 400 when position missing", async () => {
    const res = await PATCH_POSITION(
      createContext(
        jsonRequest("http://localhost/api/columns/1/position", "PATCH", {}),
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
        jsonRequest("http://localhost/api/columns/1/position", "PATCH", {
          position: "abc" as unknown as number,
        }),
        { id: "1" }
      )
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 when column not found", async () => {
    const res = await PATCH_POSITION(
      createContext(
        jsonRequest(
          "http://localhost/api/columns/99999/position",
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
        jsonRequest("http://localhost/api/columns/abc/position", "PATCH", {
          position: 500,
        }),
        { id: "abc" }
      )
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for malformed JSON", async () => {
    const req = new Request("http://localhost/api/columns/1/position", {
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

describe("Automatic rebalancing via API", () => {
  it("rebalances column positions after API position update when gap < 10", async () => {
    const board = createBoard("Rebalance Board");
    const col1 = createColumn(board.id, "Col 1");
    const col2 = createColumn(board.id, "Col 2");
    const col3 = createColumn(board.id, "Col 3");

    updateColumnPosition(col1.id, 1000);
    updateColumnPosition(col2.id, 1005);

    const res = await PATCH_POSITION(
      createContext(
        jsonRequest(`http://localhost/api/columns/${col3.id}/position`, "PATCH", { position: 1008 }),
        { id: String(col3.id) }
      )
    );
    expect(res.status).toBe(200);

    const columns = listColumnsByBoard(board.id);
    expect(columns[0].position).toBe(1000);
    expect(columns[1].position).toBe(2000);
    expect(columns[2].position).toBe(3000);
  });

  it("preserves relative order during API-triggered rebalancing", async () => {
    const board = createBoard("Order Board");
    const col1 = createColumn(board.id, "Alpha");
    const col2 = createColumn(board.id, "Beta");
    const col3 = createColumn(board.id, "Gamma");

    updateColumnPosition(col1.id, 100);
    updateColumnPosition(col2.id, 105);

    await PATCH_POSITION(
      createContext(
        jsonRequest(`http://localhost/api/columns/${col3.id}/position`, "PATCH", { position: 107 }),
        { id: String(col3.id) }
      )
    );

    const columns = listColumnsByBoard(board.id);
    expect(columns[0].id).toBe(col1.id);
    expect(columns[1].id).toBe(col2.id);
    expect(columns[2].id).toBe(col3.id);
  });
});
