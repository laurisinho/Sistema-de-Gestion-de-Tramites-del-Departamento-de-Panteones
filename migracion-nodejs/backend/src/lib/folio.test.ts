import { describe, expect, it } from "vitest";
import { generarFolio, generarFolioCesion } from "./folio";

/**
 * Cliente de Prisma falso con solo los métodos que usan generarFolio y
 * generarFolioCesion (lote.findMany, tituloPropiedad.findUnique,
 * cesionDerechos.findMany/findUnique), sobre datos en memoria. Evita depender
 * de una base para las pruebas.
 */
type LoteFalso = { numeroManzana: string; numeroLote: string; claveLegado: string | null };

function crearTxFalso(opts: { lotes?: LoteFalso[]; foliosOcupados?: string[]; cesionesExistentes?: string[] } = {}) {
  const lotes = opts.lotes ?? [];
  const foliosOcupados = new Set(opts.foliosOcupados ?? []);
  const cesionesExistentes = opts.cesionesExistentes ?? [];

  return {
    lote: {
      // generarFolio ya filtra por sección en la consulta real; aquí se devuelve la
      // muestra tal cual porque cada prueba la arma acotada.
      findMany: async () => lotes.slice(),
    },
    tituloPropiedad: {
      findUnique: async ({ where }: { where: { folio: string } }) =>
        foliosOcupados.has(where.folio) ? { folio: where.folio } : null,
    },
    cesionDerechos: {
      findMany: async () => cesionesExistentes.map((folio) => ({ folio })),
      findUnique: async ({ where }: { where: { folio: string } }) =>
        cesionesExistentes.includes(where.folio) ? { folio: where.folio } : null,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("generarFolio", () => {
  it("reproduce el formato de TERRAZAS a partir del acervo", async () => {
    const tx = crearTxFalso({
      lotes: [
        { numeroManzana: "1", numeroLote: "1", claveLegado: "PJE-TRZA1-1" },
        { numeroManzana: "1", numeroLote: "2", claveLegado: "PJE-TRZA1-2" },
        { numeroManzana: "1", numeroLote: "3", claveLegado: "PJE-TRZA1-3" },
      ],
    });
    const folio = await generarFolio(tx, 1, "PJE", "TERRAZAS", "9", "99");
    // Resultado esperado: PJE-TRZA9-99.
    expect(folio).toBe("PJE-TRZA9-99");
  });

  it("reproduce el formato de AMP (manzana y lote con dos dígitos)", async () => {
    const tx = crearTxFalso({
      lotes: [
        { numeroManzana: "1", numeroLote: "1-J", claveLegado: "PJE-AMP-01-01" },
        { numeroManzana: "1", numeroLote: "2-I", claveLegado: "PJE-AMP-01-02" },
        { numeroManzana: "1", numeroLote: "3-I", claveLegado: "PJE-AMP-01-03" },
      ],
    });
    const folio = await generarFolio(tx, 1, "PJE", "AMP", "5", "5-X");
    expect(folio).toBe("PJE-AMP-05-05");
  });

  it("ADEII sin Angelitos captura manzana y lote, sin importar el acervo", async () => {
    // La muestra usa el patrón antiguo (solo manzana, sin lote) para comprobar que
    // la regla fija de ADEII lo ignora.
    const tx = crearTxFalso({
      lotes: [
        { numeroManzana: "IX", numeroLote: "1", claveLegado: "PJE-ADEII-09" },
        { numeroManzana: "VIII", numeroLote: "1", claveLegado: "PJE-ADEII-08" },
      ],
    });
    const folio = await generarFolio(tx, 1, "PJE", "ADEII", "7", "7-Z");
    expect(folio).toBe("PJE-ADEII-07-07");
  });

  it.each(["ANGELITOS", "ANGELITIOS", "angelitos", "  Angelitos  "])(
    "ADEII con manzana %s se captura tal cual, sin manzana en el folio",
    async (manzana) => {
      const tx = crearTxFalso();
      const folio = await generarFolio(tx, 1, "PJE", "ADEII", manzana, "50");
      expect(folio).toBe("PJE-ANG-50");
    }
  );

  it("una sección sin formato consistente cae al respaldo {clave}-{manzana}-{lote}", async () => {
    const tx = crearTxFalso({
      lotes: [
        { numeroManzana: "TALUD", numeroLote: "10", claveLegado: "PJE-PDNR-TALUD 10" },
        { numeroManzana: "TALUD", numeroLote: "1", claveLegado: "PJE-PDNR TALUD 01" },
        { numeroManzana: "AMPII", numeroLote: "17", claveLegado: "PJE-PDNR-AMPII-17" },
      ],
    });
    const folio = await generarFolio(tx, 1, "PJE", "ARBOL DEL EDEN II", "5", "5");
    expect(folio).toBe("PJE-5-5");
  });

  it("una sección sin ningún lote previo cae al respaldo", async () => {
    const tx = crearTxFalso();
    const folio = await generarFolio(tx, 1, "PJE", "SECCION NUEVA", "3", "8");
    expect(folio).toBe("PJE-3-8");
  });

  it("un panteón de colindancias (sin sección) usa el respaldo", async () => {
    const tx = crearTxFalso();
    const folio = await generarFolio(tx, 3, "PH", null, "S/N", "109");
    expect(folio).toBe("PH-SN-109");
  });

  it("agrega un consecutivo si el folio base ya está ocupado", async () => {
    // Sección sin acervo: usa el respaldo {clave}-{manzana}-{lote} sin relleno de
    // ceros ("PJE-ANEXO-1").
    const tx = crearTxFalso({ foliosOcupados: ["PJE-ANEXO-1"] });
    const folio = await generarFolio(tx, 1, "PJE", "ANEXO NUEVA", "ANEXO", "1");
    expect(folio).toBe("PJE-ANEXO-1-2");
  });
});

describe("generarFolioCesion", () => {
  it("empieza en CES-0001 cuando no hay ninguna cesión", async () => {
    const tx = crearTxFalso();
    expect(await generarFolioCesion(tx)).toBe("CES-0001");
  });

  it("continúa el consecutivo más alto, sin importar el orden", async () => {
    const tx = crearTxFalso({ cesionesExistentes: ["CES-0003", "CES-0001", "CES-0002"] });
    expect(await generarFolioCesion(tx)).toBe("CES-0004");
  });

  it("ignora folios de cesión con un sufijo no numérico", async () => {
    const tx = crearTxFalso({ cesionesExistentes: ["CES-0005", "CES-PRUEBA"] });
    expect(await generarFolioCesion(tx)).toBe("CES-0006");
  });
});
