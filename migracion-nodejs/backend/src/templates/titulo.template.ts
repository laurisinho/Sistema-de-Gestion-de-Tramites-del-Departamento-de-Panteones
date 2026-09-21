import type { Prisma } from "@prisma/client";
import type { AparienciaDocumento } from "../lib/apariencia";
import { esc, fechaLarga, fechaHoraCorta } from "../lib/html";

const GRIS_CLARO = "#F5F5F5";
const DIMENSIONES = "1.50 m de frente por 2.50 m de largo";

export type TituloParaPdf = Prisma.TituloPropiedadGetPayload<{
  include: { titular: true; lote: { include: { panteon: true; tipoLote: true } } };
}>;

const CLAUSULAS = [
  "El titular se compromete a respetar y cumplir fielmente con lo dispuesto en el Reglamento de Panteones y Cementerios Municipales de la ciudad de Nogales, Sonora, México.",
  "Asimismo, deberá mantener y conservar las instalaciones y jardines del panteón, así como la limpieza y orden dentro del mismo.",
  "El presente Título no podrá ser traspasado a menos que se autorice expresamente por el propietario, notificando tal acto a Sindicatura Municipal.",
  "Este título deberá ser renovado cada diez años, según lo estipulado en el artículo 59 del citado Reglamento y conforme al procedimiento establecido al efecto por esta Dependencia.",
];

export function tituloHtml(
  titulo: TituloParaPdf,
  apariencia: AparienciaDocumento,
  opts: { esReimpresion?: boolean; fechaReimpresion?: Date; numeroReimpresion?: number } = {}
): string {
  const p = apariencia.paleta;
  const usaColindancias = titulo.lote?.numeroManzana === "S/N";
  const { esReimpresion, fechaReimpresion, numeroReimpresion = 0 } = opts;

  const watermark = esReimpresion ? `<div class="watermark">REIMPRESIÓN</div>` : "";
  const reimpresionLinea =
    esReimpresion && fechaReimpresion
      ? `<div class="hdr-reimp">REIMPRESIÓN ${numeroReimpresion > 0 ? `Nº ${numeroReimpresion} ` : ""}— ${fechaHoraCorta(fechaReimpresion)}</div>`
      : "";

  const celda = (etiqueta: string, valor: string) =>
    `<div class="ubic-celda"><div class="uf-et">${etiqueta}</div><div class="uf-val">${esc(valor)}</div></div>`;

  const ubicacionInterior = usaColindancias
    ? `<div class="ubic-grid2">
         ${celda("NORTE", (titulo.lote?.colindanciaNorte || "—").toUpperCase())}
         ${celda("ESTE", (titulo.lote?.colindanciaEste || "—").toUpperCase())}
         ${celda("SUR", (titulo.lote?.colindanciaSur || "—").toUpperCase())}
         ${celda("OESTE", (titulo.lote?.colindanciaOeste || "—").toUpperCase())}
       </div>`
    : `<div class="ubic-grid3">
         ${celda("SECCIÓN", (titulo.lote?.seccion || "—").toUpperCase())}
         ${celda("MANZANA", (titulo.lote?.numeroManzana || "—").toUpperCase())}
         ${celda("LOTE", titulo.lote?.numeroLote ?? "—")}
       </div>`;

  // La hoja es de tamaño fijo. El nombre del titular sale dos veces (cuerpo y
  // firma) y las colindancias pueden ser largas, así que con mucho texto la letra
  // baja un poco para que el título siga cabiendo en una sola página. El nombre
  // más largo hoy mide 200 caracteres; el promedio, 25.
  const largoNombre = (titulo.titular.nombreCompleto || "").length;
  const largoColindancia = usaColindancias
    ? Math.max(
        ...[titulo.lote?.colindanciaNorte, titulo.lote?.colindanciaSur, titulo.lote?.colindanciaEste, titulo.lote?.colindanciaOeste].map(
          (c) => (c || "").length
        )
      )
    : 0;
  const carga = largoNombre + largoColindancia;
  const escala = carga > 200 ? 0.78 : carga > 120 ? 0.84 : carga > 90 ? 0.9 : carga > 70 ? 0.95 : 1;

  const ident = titulo.titular.identificacionNumero;
  const identTexto = ident?.trim()
    ? `<strong>${esc(titulo.titular.identificacionTipo?.trim() || "credencial para votar (INE)")} No. ${esc(ident)}</strong>`
    : "  ___________________________________  ";

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page { size: Letter; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Arial, sans-serif; font-size: 11pt; color: #1a1a1a; }
  .page { --k: ${escala}; width: 8.5in; min-height: 11in; padding: 1cm 1.8cm; display: flex; flex-direction: column; position: relative; }
  .watermark {
    position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg);
    font-size: 62pt; font-weight: bold; color: ${p.marcaAgua}; letter-spacing: 2pt; white-space: nowrap; z-index: 0;
  }
  .header-row { display: flex; align-items: center; }
  .hdr-logo-left { width: 100pt; flex-shrink: 0; }
  .hdr-logo-left img { width: 90pt; }
  .hdr-logo-right { width: 90pt; flex-shrink: 0; text-align: right; }
  .hdr-logo-right img { width: 80pt; }
  .hdr-center { flex: 1; text-align: center; }
  .hdr-t1 { font-size: 8pt; color: ${p.guindaOscuro}; font-weight: bold; }
  .hdr-t2 { font-size: 7pt; color: ${p.guinda}; }
  .hdr-t3 { font-size: 10pt; color: ${p.guindaOscuro}; font-weight: bold; padding-top: 2pt; }
  .hdr-reimp { font-size: 7pt; color: #CC0000; font-weight: bold; padding-top: 2pt; }
  .hdr-rule { border-top: 2pt solid ${p.guinda}; margin-top: 3pt; }

  /* El contenido se reparte a lo alto de la hoja: los cuatro grupos quedan
     separados de forma pareja y las firmas al fondo, en lugar de amontonarse
     arriba con el resto de la página en blanco. */
  .contenido { flex: 1; display: flex; flex-direction: column; justify-content: space-between; gap: 12pt; padding-top: 10pt; z-index: 1; }

  .banner { display: flex; align-items: center; background: ${p.guinda}; color: #fff; padding: 11pt 12pt; }
  .banner-titulo { flex: 1; font-weight: bold; font-size: 18pt; letter-spacing: 0.6pt; }
  .banner-folio { width: 210pt; text-align: right; font-size: 13pt; }
  .banner-folio span { color: #F5D58A; font-size: 10pt; font-weight: normal; }

  .fecha-emision { text-align: right; padding-top: 10pt; font-size: 11.5pt; }

  .cuerpo-legal { font-size: calc(var(--k) * 12.5pt); line-height: 1.6; text-align: justify; }

  .ubic-tabla { margin-top: 14pt; border: 0.5pt solid #DDDDDD; border-left: 5pt solid ${p.guinda}; background: ${GRIS_CLARO}; padding: 14pt 18pt; }
  .ubic-grid3 { display: grid; grid-template-columns: 1.5fr 1fr 1fr; gap: 14pt; }
  /* Dos columnas rellenadas por columna: NORTE y ESTE a la izquierda, SUR y OESTE a la derecha. */
  .ubic-grid2 { display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: repeat(2, auto); grid-auto-flow: column; gap: 8pt 16pt; }
  .ubic-celda { min-width: 0; }
  .uf-et { font-size: 9pt; font-weight: bold; letter-spacing: 1pt; color: ${p.guindaOscuro}; }
  .uf-val { padding-top: 3pt; font-size: calc(var(--k) * 18pt); font-weight: bold; overflow-wrap: anywhere; }
  .ubic-grid2 .uf-val { font-size: calc(var(--k) * 11.5pt); font-weight: normal; }

  .clausula { display: flex; gap: 9pt; padding-bottom: 10pt; }
  .clausula-bullet { color: ${p.guinda}; font-weight: bold; width: 10pt; }
  .clausula-texto { font-size: calc(var(--k) * 11.5pt); line-height: 1.55; text-align: justify; flex: 1; }

  .identificacion { padding-top: 8pt; font-size: calc(var(--k) * 11.5pt); }
  .recibo { padding-top: 6pt; font-size: calc(var(--k) * 11pt); color: #555555; }

  .firmas { display: flex; padding-top: 28pt; }
  .firma-col { flex: 1; text-align: center; }
  .firma-sep { width: 40pt; }
  .firma-linea { font-size: 11pt; }
  .firma-nombre { padding-top: 3pt; font-weight: bold; font-size: calc(var(--k) * 11pt); }
  .firma-cargo { font-size: 10pt; color: ${p.guinda}; }

  .pie { text-align: center; font-size: 7pt; color: #999999; padding-top: 10pt; z-index: 1; }
</style>
</head>
<body>
<div class="page">
  ${watermark}
  <div class="header-row">
    <div class="hdr-logo-left"><img src="${apariencia.logoNogales}" /></div>
    <div class="hdr-center">
      <div class="hdr-t1">H. AYUNTAMIENTO DE NOGALES</div>
      <div class="hdr-t2">SINDICATURA MUNICIPAL</div>
      <div class="hdr-t3">DEPARTAMENTO DE CONTROL DE PANTEONES</div>
      ${reimpresionLinea}
    </div>
    <div class="hdr-logo-right"><img src="${apariencia.logoFrontera}" /></div>
  </div>
  <div class="hdr-rule"></div>

  <div class="contenido">
    <div class="grupo">
      <div class="banner">
        <div class="banner-titulo">TÍTULO DE PROPIEDAD</div>
        <div class="banner-folio"><span>Folio: </span><strong>${esc(titulo.folio)}</strong></div>
      </div>
      <div class="fecha-emision">H. Nogales, Sonora, México a ${fechaLarga(titulo.fechaEmision)}.</div>
    </div>

    <div class="grupo">
    <div class="cuerpo-legal">
      Que se expide a favor de C. <strong>${esc((titulo.titular.nombreCompleto || "").toUpperCase())}</strong>
      en relación a lote de terreno ubicado en el Panteón <strong>${esc((titulo.lote?.panteon.nombre || "").toUpperCase())}</strong>
      cuya superficie es de ${DIMENSIONES} y se ampara en el decreto publicado en el Reglamento de Panteones y
      Cementerios Municipales de la Ciudad de Nogales, Sonora, México en cuanto a sus dimensiones, el cual deberá
      ser utilizado de manera exclusiva para la inhumación de los restos de la persona que indique el titular o
      sus representados.
    </div>

    <div class="ubic-tabla">${ubicacionInterior}</div>
    </div>

    <div class="grupo">
      <div class="clausulas">
        ${CLAUSULAS.map((c) => `<div class="clausula"><div class="clausula-bullet">•</div><div class="clausula-texto">${esc(c)}</div></div>`).join("\n")}
      </div>

      <div class="identificacion">
        El titular se identifica con ${identTexto} al momento de la expedición del presente título.
      </div>
      <div class="recibo">No. de Recibo: ${titulo.numeroRecibo?.trim() ? esc(titulo.numeroRecibo) : "____________________"}</div>
    </div>

    <div class="firmas">
      <div class="firma-col">
        <div class="firma-linea">____________________________________</div>
        <div class="firma-nombre">${esc(apariencia.sindico)}</div>
        <div class="firma-cargo">EL SÍNDICO MUNICIPAL</div>
      </div>
      <div class="firma-sep"></div>
      <div class="firma-col">
        <div class="firma-linea">____________________________________</div>
        <div class="firma-nombre">${esc((titulo.titular.nombreCompleto || "").toUpperCase())}</div>
        <div class="firma-cargo">EL TITULAR</div>
      </div>
    </div>
  </div>

  <div class="pie">Reglamento de Panteones y Cementerios Municipales de Nogales, Sonora — Art. 59</div>
</div>
</body>
</html>`;
}
