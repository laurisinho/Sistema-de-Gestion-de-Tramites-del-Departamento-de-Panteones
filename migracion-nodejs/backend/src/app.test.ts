import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Prueba de extremo a extremo sobre la app real (sin mocks de rutas ni de
// Prisma): un cuerpo grande o mal formado no debe tumbar la API con un 500 ni
// debe bloquear la subida de un logo válido. No se ejecuta ninguna consulta a
// la base porque los casos aquí se resuelven antes (falta de autenticación o
// error de body-parser), así que valores de conexión de mentira bastan.
process.env.JWT_SECRET ??= "x".repeat(32);
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
process.env.DIRECT_URL ??= process.env.DATABASE_URL;

const { app } = await import("./app");

let servidor: ReturnType<typeof app.listen>;
let base = "";

beforeAll(() => {
  servidor = app.listen(0);
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
});
afterAll(() => {
  servidor.close();
});

describe("cuerpos de solicitud mal formados o grandes", () => {
  it("un JSON mal formado responde 400 y no 500", async () => {
    const r = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{esto no es json",
    });
    expect(r.status).toBe(400);
    expect((await r.json()) as { error: string }).toMatchObject({ error: expect.any(String) });
  });

  it("un logo de más de 100 KB (el límite genérico) llega a la ruta en vez de rechazarse antes", async () => {
    // Sin autenticación: si el cuerpo se parseó, la respuesta es 401 (llegó a
    // requiereAuth). Si el body-parser genérico lo hubiera rechazado antes por
    // exceder su límite de 100 KB, la respuesta habría sido 500.
    const grande = "A".repeat(150 * 1024);
    const r = await fetch(`${base}/api/administracion/apariencia/logo/nogales`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataUri: `data:image/png;base64,${grande}` }),
    });
    expect(r.status).toBe(401);
  });

  it("un logo de más de 3 MB responde 413 y no 500", async () => {
    const enorme = "A".repeat(4 * 1024 * 1024);
    const r = await fetch(`${base}/api/administracion/apariencia/logo/nogales`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataUri: `data:image/png;base64,${enorme}` }),
    });
    expect(r.status).toBe(413);
  });

  it("un cuerpo grande a cualquier otra ruta sigue topando con el límite genérico", async () => {
    const grande = "A".repeat(150 * 1024);
    const r = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombreUsuario: "x", password: grande }),
    });
    expect(r.status).toBe(413);
  });
});
