import { afterEach, describe, expect, it, vi } from "vitest";
import { fechaHoraLocalCorta, hoyLocal } from "./fechas";
import { fechaHoraCorta, fechaLarga } from "./html";

afterEach(() => vi.useRealTimers());

describe("hoyLocal", () => {
  it("usa el día de Nogales cuando en UTC ya es el día siguiente", () => {
    // 19:00 del 20 de septiembre en Sonora = 02:00 UTC del 21.
    expect(hoyLocal(new Date("2026-09-21T02:00:00Z")).toISOString()).toBe("2026-09-20T00:00:00.000Z");
  });

  it("no cambia durante el día", () => {
    expect(hoyLocal(new Date("2026-09-20T18:00:00Z")).toISOString()).toBe("2026-09-20T00:00:00.000Z");
  });

  it("conserva el año anterior hasta la medianoche local", () => {
    // 22:00 del 31 de diciembre en Sonora = 05:00 UTC del 1 de enero.
    expect(hoyLocal(new Date("2026-01-01T05:00:00Z")).toISOString()).toBe("2025-12-31T00:00:00.000Z");
  });
});

describe("fechas de documentos", () => {
  it("fechaLarga sin fecha imprime el día de Nogales", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-21T02:00:00Z"));
    expect(fechaLarga(null)).toBe("20 de septiembre de 2026");
  });

  it("fechaLarga con fecha guardada no la desplaza", () => {
    expect(fechaLarga(new Date("2026-03-05T00:00:00Z"))).toBe("05 de marzo de 2026");
  });

  it("el sello de reimpresión muestra la hora de Nogales", () => {
    const instante = new Date("2026-09-21T02:05:00Z");
    expect(fechaHoraLocalCorta(instante)).toBe("20/09/2026 19:05");
    expect(fechaHoraCorta(instante)).toBe("20/09/2026 19:05");
  });

  it("la medianoche local se muestra como 00:xx y no como 24:xx", () => {
    expect(fechaHoraLocalCorta(new Date("2026-09-20T07:30:00Z"))).toBe("20/09/2026 00:30");
  });
});
