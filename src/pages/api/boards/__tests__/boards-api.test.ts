import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { unlinkSync } from "node:fs";
import { getDb, closeDb } from "../../../../lib/db/connection";
import { GET, POST } from "../index";
import { PATCH, DELETE } from "../[id]";

let tempDbPath: string;

function createContext(
  request: Request,
  params: Record<string, string> = {}
): any {
  return { request, params };
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
    `test-api-${Date.now()}-${Math.random().toString(36).slice(2)}.db`
  );
  getDb(tempDbPath);
});

afterEach(() => {
  closeDb();
  try { unlinkSync(tempDbPath); } catch {}
  try { unlinkSync(tempDbPath + "-wal"); } catch {}
  try { unlinkSync(tempDbPath + "-shm"); } catch {}
});

describe("GET /api/boards", () => {
  it("returns 200 with empty array when no boards", async () => {
    const req = new Request("http://localhost/api/boards");
    const res = await GET(createContext(req));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual([]);
  });

  it("returns 200 with boards after creating some", async () => {
    await POST(
      createContext(jsonRequest("http://localhost/api/boards", "POST", { name: "Board A" }))
    );
    await POST(
      createContext(jsonRequest("http://localhost/api/boards", "POST", { name: "Board B" }))
    );

    const res = await GET(createContext(new Request("http://localhost/api/boards")));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(2);
  });
});

describe("POST /api/boards", () => {
  it("returns 201 with created board when name provided", async () => {
    const res = await POST(
      createContext(jsonRequest("http://localhost/api/boards", "POST", { name: "New Board" }))
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.name).toBe("New Board");
    expect(data.id).toBeTypeOf("number");
  });

  it("returns 400 when name missing", async () => {
    const res = await POST(
      createContext(jsonRequest("http://localhost/api/boards", "POST", {}))
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when name is empty string", async () => {
    const res = await POST(
      createContext(jsonRequest("http://localhost/api/boards", "POST", { name: "" }))
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for malformed JSON in POST", async () => {
    const req = new Request("http://localhost/api/boards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{invalid json",
    });
    const res = await POST(createContext(req));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Invalid JSON");
  });

  it("returns 400 when POST body is missing", async () => {
    const req = new Request("http://localhost/api/boards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(createContext(req));
    expect(res.status).toBe(400);
  });

  it("handles POST with null name", async () => {
    const res = await POST(
      createContext(jsonRequest("http://localhost/api/boards", "POST", { name: null as unknown as string }))
    );
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/boards/:id", () => {
  it("returns 200 with updated board", async () => {
    const createRes = await POST(
      createContext(jsonRequest("http://localhost/api/boards", "POST", { name: "Old Name" }))
    );
    const board = await createRes.json();

    const res = await PATCH(
      createContext(
        jsonRequest(`http://localhost/api/boards/${board.id}`, "PATCH", { name: "New Name" }),
        { id: String(board.id) }
      )
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.name).toBe("New Name");
  });

  it("returns 400 when name missing", async () => {
    const res = await PATCH(
      createContext(
        jsonRequest("http://localhost/api/boards/1", "PATCH", {}),
        { id: "1" }
      )
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 when board doesn't exist", async () => {
    const res = await PATCH(
      createContext(
        jsonRequest("http://localhost/api/boards/99999", "PATCH", { name: "Nope" }),
        { id: "99999" }
      )
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 for invalid id", async () => {
    const res = await PATCH(
      createContext(
        jsonRequest("http://localhost/api/boards/abc", "PATCH", { name: "Test" }),
        { id: "abc" }
      )
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for malformed JSON in PATCH", async () => {
    const req = new Request("http://localhost/api/boards/1", {
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

describe("DELETE /api/boards/:id", () => {
  it("returns 204 on successful delete", async () => {
    const createRes = await POST(
      createContext(jsonRequest("http://localhost/api/boards", "POST", { name: "To Delete" }))
    );
    const board = await createRes.json();

    const res = await DELETE(
      createContext(
        new Request(`http://localhost/api/boards/${board.id}`, { method: "DELETE" }),
        { id: String(board.id) }
      )
    );
    expect(res.status).toBe(204);
  });

  it("returns 404 when board doesn't exist", async () => {
    const res = await DELETE(
      createContext(
        new Request("http://localhost/api/boards/99999", { method: "DELETE" }),
        { id: "99999" }
      )
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 for invalid id", async () => {
    const res = await DELETE(
      createContext(
        new Request("http://localhost/api/boards/abc", { method: "DELETE" }),
        { id: "abc" }
      )
    );
    expect(res.status).toBe(400);
  });
});
