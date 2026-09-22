import type { Prisma } from "@prisma/client";
import type { AparienciaDocumento } from "../lib/apariencia";
import { esc, fechaLarga, fechaHoraCorta } from "../lib/html";

const GRIS_CLARO = "#F5F5F5";
const DIMENSIONES = "1.50 m de frente por 2.50 m de largo";

export type TituloParaPdf = Prisma.TituloPropiedadGetPayload<{
  include: { titular: true; lote: { include: { panteon: true; tipoLote: true } } };
}>;

// Iconos del pie de página (bootstrap-icons, incrustados como SVG para que se
// vean igual en el PDF sin depender de una fuente de íconos instalada).
const ICONO_TELEFONO =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M1.885.511a1.745 1.745 0 0 1 2.61.163L6.29 2.98c.329.423.445.974.315 1.494l-.547 2.19a.68.68 0 0 0 .178.643l2.457 2.457a.68.68 0 0 0 .644.178l2.189-.547a1.75 1.75 0 0 1 1.494.315l2.306 1.794c.829.645.905 1.87.163 2.611l-1.034 1.034c-.74.74-1.846 1.065-2.877.702a18.6 18.6 0 0 1-7.01-4.42 18.6 18.6 0 0 1-4.42-7.009c-.362-1.03-.037-2.137.703-2.877z"/></svg>';
const ICONO_FACEBOOK =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M16 8.049c0-4.446-3.582-8.05-8-8.05C3.58 0-.002 3.603-.002 8.05c0 4.017 2.926 7.347 6.75 7.951v-5.625h-2.03V8.05H6.75V6.275c0-2.017 1.195-3.131 3.022-3.131.876 0 1.791.157 1.791.157v1.98h-1.009c-.993 0-1.303.621-1.303 1.258v1.51h2.218l-.354 2.326H9.25V16c3.824-.604 6.75-3.934 6.75-7.951"/></svg>';
const ICONO_GLOBO =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8m7.5-6.923c-.67.204-1.335.82-1.887 1.855A8 8 0 0 0 5.145 4H7.5zM4.09 4a9.3 9.3 0 0 1 .64-1.539 7 7 0 0 1 .597-.933A7.03 7.03 0 0 0 2.255 4zm-.582 3.5c.03-.877.138-1.718.312-2.5H1.674a7 7 0 0 0-.656 2.5zM4.847 5a12.5 12.5 0 0 0-.338 2.5H7.5V5zM8.5 5v2.5h2.99a12.5 12.5 0 0 0-.337-2.5zM4.51 8.5a12.5 12.5 0 0 0 .337 2.5H7.5V8.5zm3.99 0V11h2.653c.187-.765.306-1.608.338-2.5zM5.145 12q.208.58.468 1.068c.552 1.035 1.218 1.65 1.887 1.855V12zm.182 2.472a7 7 0 0 1-.597-.933A9.3 9.3 0 0 1 4.09 12H2.255a7 7 0 0 0 3.072 2.472M3.82 11a13.7 13.7 0 0 1-.312-2.5h-2.49c.062.89.291 1.733.656 2.5zm6.853 3.472A7 7 0 0 0 13.745 12H11.91a9.3 9.3 0 0 1-.64 1.539 7 7 0 0 1-.597.933M8.5 12v2.923c.67-.204 1.335-.82 1.887-1.855q.26-.487.468-1.068zm3.68-1h2.146c.365-.767.594-1.61.656-2.5h-2.49a13.7 13.7 0 0 1-.312 2.5m2.802-3.5a7 7 0 0 0-.656-2.5H12.18c.174.782.282 1.623.312 2.5zM11.27 2.461c.247.464.462.98.64 1.539h1.835a7 7 0 0 0-3.072-2.472c.218.284.418.598.597.933M10.855 4a8 8 0 0 0-.468-1.068C9.835 1.897 9.17 1.282 8.5 1.077V4z"/></svg>';

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

  .ubic-tabla { margin-top: 10pt; border: 0.5pt solid #DDDDDD; border-left: 4pt solid ${p.guinda}; background: ${GRIS_CLARO}; padding: 8pt 14pt; }
  .ubic-grid3 { display: grid; grid-template-columns: 1.5fr 1fr 1fr; gap: 10pt; }
  /* Dos columnas rellenadas por columna: NORTE y ESTE a la izquierda, SUR y OESTE a la derecha. */
  .ubic-grid2 { display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: repeat(2, auto); grid-auto-flow: column; gap: 6pt 16pt; }
  .ubic-celda { min-width: 0; }
  .uf-et { font-size: 7pt; font-weight: bold; letter-spacing: 0.8pt; color: ${p.guindaOscuro}; }
  .uf-val { padding-top: 1pt; font-size: calc(var(--k) * 13pt); font-weight: bold; overflow-wrap: anywhere; }
  .ubic-grid2 .uf-val { font-size: calc(var(--k) * 10pt); font-weight: normal; }

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

  .pie { padding-top: 8pt; z-index: 1; }
  .pie-reglamento { text-align: center; font-size: 6pt; color: #999999; margin-bottom: 4pt; }
  .pie-rule { border-top: 1.2pt solid ${p.guinda}; margin-bottom: 5pt; }
  .pie-ayto { display: flex; align-items: center; justify-content: center; gap: 6pt; font-size: 7.5pt; font-weight: 700; color: #333333; }
  .pie-ayto img { height: 12pt; }
  .pie-contacto { display: flex; align-items: center; justify-content: center; gap: 16pt; font-size: 7pt; color: #666666; margin-top: 3pt; }
  .pie-item { display: flex; align-items: center; gap: 3pt; }
  .pie-item svg { width: 7.5pt; height: 7.5pt; fill: ${p.guinda}; flex-shrink: 0; }
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

  <div class="pie">
    <div class="pie-reglamento">Reglamento de Panteones y Cementerios Municipales de Nogales, Sonora — Art. 59</div>
    <div class="pie-rule"></div>
    <div class="pie-ayto">
      <img src="${apariencia.logoNogales}" alt="" />
      <span>Ayuntamiento. Ave. Obregón No. 339, Col. Centro. C.P. 84000</span>
    </div>
    <div class="pie-contacto">
      <div class="pie-item">${ICONO_TELEFONO}<span>+52 (631) 162 5000</span></div>
      <div class="pie-item">${ICONO_FACEBOOK}<span>@gobiernodenogales</span></div>
      <div class="pie-item">${ICONO_GLOBO}<span>municipio.nogales-sonora.gob.mx</span></div>
    </div>
  </div>
</div>
</body>
</html>`;
}
