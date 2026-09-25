import { describe, expect, it } from "vitest";
import { resumenPorPanteon, type LoteBase, type PanteonBase, type PermisoBase } from "./reportePanteones";

const panteones: PanteonBase[] = [
  { panteonId: 1, nombre: "Jardines del Edén", activo: true },
  { panteonId: 2, nombre: "Agua Zarca", activo: false },
];

describe("resumenPorPanteon", () => {
  it("cuenta lotes por estado, fosa común y título vigente, separados por panteón", () => {
    const lotes: LoteBase[] = [
      { panteonId: 1, estado: "OCUPADO", esFosaComun: false, conTituloVigente: true },
      { panteonId: 1, estado: "DISPONIBLE", esFosaComun: false, conTituloVigente: true },
      { panteonId: 1, estado: "DISPONIBLE", esFosaComun: true, conTituloVigente: false },
      { panteonId: 2, estado: "OCUPADO", esFosaComun: false, conTituloVigente: false },
    ];
    const [edén, zarca] = resumenPorPanteon(panteones, lotes, []);

    expect(edén).toMatchObject({ lotes: 3, ocupados: 1, disponibles: 2, fosaComun: 1, conTitulo: 2 });
    expect(zarca).toMatchObject({ lotes: 1, ocupados: 1, disponibles: 0, fosaComun: 0, conTitulo: 0 });
  });

  it("marca los panteones inactivos en el nombre", () => {
    const filas = resumenPorPanteon(panteones, [], []);
    expect(filas[0].nombre).toBe("Jardines del Edén");
    expect(filas[1].nombre).toBe("Agua Zarca (inactivo)");
  });

  it("cuenta los trámites por tipo en el panteón que les corresponde", () => {
    const permisos: PermisoBase[] = [
      { clave: "SEP", panteonId: 1, fallecidoId: 10 },
      { clave: "SEP", panteonId: 1, fallecidoId: 11 },
      { clave: "CEN", panteonId: 1, fallecidoId: 12 },
      { clave: "CON", panteonId: 1, fallecidoId: null },
      { clave: "SEP", panteonId: 2, fallecidoId: 20 },
    ];
    const [edén, zarca] = resumenPorPanteon(panteones, [], permisos);

    expect(edén).toMatchObject({ sepulturas: 2, cenizas: 1, construcciones: 1, exhumaciones: 0 });
    expect(zarca).toMatchObject({ sepulturas: 1, cenizas: 0 });
  });

  it("los sepultados son personas distintas con sepultura o cenizas, sin las exhumadas", () => {
    const permisos: PermisoBase[] = [
      { clave: "SEP", panteonId: 1, fallecidoId: 10 },
      { clave: "SEP", panteonId: 1, fallecidoId: 11 },
      { clave: "CEN", panteonId: 1, fallecidoId: 12 },
      { clave: "EXH", panteonId: 1, fallecidoId: 11 }, // 11 ya salió
      { clave: "SEP", panteonId: 1, fallecidoId: 10 }, // repetido: cuenta una vez
    ];
    const [edén] = resumenPorPanteon(panteones, [], permisos);

    expect(edén.sepultados).toBe(2); // 10 y 12
    expect(edén.exhumaciones).toBe(1);
  });

  it("un permiso sin difunto (p. ej. construcción) no suma a los sepultados", () => {
    const [edén] = resumenPorPanteon(panteones, [], [{ clave: "SEP", panteonId: 1, fallecidoId: null }]);
    expect(edén.sepultados).toBe(0);
    expect(edén.sepulturas).toBe(1);
  });
});
