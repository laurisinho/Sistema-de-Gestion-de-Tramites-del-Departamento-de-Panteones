import type { Prisma } from "@prisma/client";
import { LOGO_NOGALES, LOGO_FRONTERA } from "../lib/logos";
import { esc, fechaLarga, fechaHoraCorta } from "../lib/html";

const SINDICO = "MAESTRA EDNA ELINORA SOTO GRACIA";
const GUINDA = "#6B1229";
const GUINDA_DARK = "#4A0C1C";
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
  opts: { esReimpresion?: boolean; fechaReimpresion?: Date; numeroReimpresion?: number } = {}
): string {
  const usaColindancias = titulo.lote?.numeroManzana === "S/N";
  const { esReimpresion, fechaReimpresion, numeroReimpresion = 0 } = opts;

  const watermark = esReimpresion ? `<div class="watermark">REIMPRESIÓN</div>` : "";
  const reimpresionLinea =
    esReimpresion && fechaReimpresion
      ? `<div class="hdr-reimp">REIMPRESIÓN ${numeroReimpresion > 0 ? `Nº ${numeroReimpresion} ` : ""}— ${fechaHoraCorta(fechaReimpresion)}</div>`
      : "";

  const ubicacionInterior = usaColindancias
    ? `<div class="ubic-row">
         <div><div class="ubic-fila"><span class="uf-et">NORTE: </span>${esc((titulo.lote?.colindanciaNorte || "—").toUpperCase())}</div>
              <div class="ubic-fila"><span class="uf-et">ESTE: </span>${esc((titulo.lote?.colindanciaEste || "—").toUpperCase())}</div></div>
         <div><div class="ubic-fila"><span class="uf-et">SUR: </span>${esc((titulo.lote?.colindanciaSur || "—").toUpperCase())}</div>
              <div class="ubic-fila"><span class="uf-et">OESTE: </span>${esc((titulo.lote?.colindanciaOeste || "—").toUpperCase())}</div></div>
       </div>`
    : `<div class="ubic-row3">
         <div><span class="uf-et">SECCIÓN: </span>${esc((titulo.lote?.seccion || "—").toUpperCase())}</div>
         <div><span class="uf-et">MANZANA: </span>${esc((titulo.lote?.numeroManzana || "—").toUpperCase())}</div>
         <div><span class="uf-et">LOTE: </span>${esc(titulo.lote?.numeroLote ?? "—")}</div>
       </div>`;

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
  body { margin: 0; font-family: Arial, sans-serif; font-size: 10pt; color: #1a1a1a; }
  .page { width: 8.5in; min-height: 11in; padding: 1cm 1.8cm; display: flex; flex-direction: column; position: relative; }
  .watermark {
    position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg);
    font-size: 62pt; font-weight: bold; color: #EAC6CE; letter-spacing: 2pt; white-space: nowrap; z-index: 0;
  }
  .header-row { display: flex; align-items: center; }
  .hdr-logo-left { width: 100pt; flex-shrink: 0; }
  .hdr-logo-left img { width: 90pt; }
  .hdr-logo-right { width: 90pt; flex-shrink: 0; text-align: right; }
  .hdr-logo-right img { width: 80pt; }
  .hdr-center { flex: 1; text-align: center; }
  .hdr-t1 { font-size: 8pt; color: ${GUINDA_DARK}; font-weight: bold; }
  .hdr-t2 { font-size: 7pt; color: ${GUINDA}; }
  .hdr-t3 { font-size: 10pt; color: ${GUINDA_DARK}; font-weight: bold; padding-top: 2pt; }
  .hdr-reimp { font-size: 7pt; color: #CC0000; font-weight: bold; padding-top: 2pt; }
  .hdr-rule { border-top: 2pt solid ${GUINDA}; margin-top: 3pt; }

  .contenido { flex: 1; padding-top: 6pt; z-index: 1; }

  .banner { display: flex; align-items: center; background: ${GUINDA}; color: #fff; padding: 6pt; margin-bottom: 2pt; }
  .banner-titulo { flex: 1; font-weight: bold; font-size: 13pt; }
  .banner-folio { width: 180pt; text-align: right; font-size: 10pt; }
  .banner-folio span { color: #F5D58A; font-size: 9pt; font-weight: normal; }

  .fecha-emision { text-align: right; padding-top: 6pt; font-size: 9.5pt; }

  .cuerpo-legal { padding-top: 8pt; font-size: 10pt; line-height: 1.4; text-align: justify; }

  .ubic-tabla { margin-top: 8pt; border: 0.5pt solid #DDDDDD; }
  .ubic-tabla-int { background: ${GRIS_CLARO}; padding: 6pt; }
  .ubic-row, .ubic-row3 { display: flex; gap: 12pt; }
  .ubic-row > div, .ubic-row3 > div { flex: 1; }
  .ubic-fila { padding-bottom: 2pt; font-size: 9pt; }
  .uf-et { font-weight: bold; color: ${GUINDA_DARK}; }

  .clausulas { padding-top: 8pt; }
  .clausula { display: flex; gap: 6pt; padding-bottom: 5pt; }
  .clausula-bullet { color: ${GUINDA}; font-weight: bold; width: 10pt; }
  .clausula-texto { font-size: 9.5pt; line-height: 1.35; text-align: justify; flex: 1; }

  .identificacion { padding-top: 4pt; font-size: 9.5pt; }
  .recibo { padding-top: 3pt; font-size: 9.5pt; color: #555555; }

  .firmas { padding-top: 30pt; display: flex; }
  .firma-col { flex: 1; text-align: center; }
  .firma-sep { width: 40pt; }
  .firma-linea { font-size: 9pt; }
  .firma-nombre { padding-top: 1pt; font-weight: bold; font-size: 9pt; }
  .firma-cargo { font-size: 8pt; color: ${GUINDA}; }

  .pie { text-align: center; font-size: 6.5pt; color: #999999; z-index: 1; }
</style>
</head>
<body>
<div class="page">
  ${watermark}
  <div class="header-row">
    <div class="hdr-logo-left"><img src="${LOGO_NOGALES}" /></div>
    <div class="hdr-center">
      <div class="hdr-t1">H. AYUNTAMIENTO DE NOGALES</div>
      <div class="hdr-t2">SINDICATURA MUNICIPAL</div>
      <div class="hdr-t3">DEPARTAMENTO DE CONTROL DE PANTEONES</div>
      ${reimpresionLinea}
    </div>
    <div class="hdr-logo-right"><img src="${LOGO_FRONTERA}" /></div>
  </div>
  <div class="hdr-rule"></div>

  <div class="contenido">
    <div class="banner">
      <div class="banner-titulo">TÍTULO DE PROPIEDAD</div>
      <div class="banner-folio"><span>Folio: </span><strong>${esc(titulo.folio)}</strong></div>
    </div>

    <div class="fecha-emision">H. Nogales, Sonora, México a ${fechaLarga(titulo.fechaEmision)}.</div>

    <div class="cuerpo-legal">
      Que se expide a favor de C. <strong>${esc((titulo.titular.nombreCompleto || "").toUpperCase())}</strong>
      en relación a lote de terreno ubicado en el Panteón <strong>${esc((titulo.lote?.panteon.nombre || "").toUpperCase())}</strong>
      cuya superficie es de ${DIMENSIONES} y se ampara en el decreto publicado en el Reglamento de Panteones y
      Cementerios Municipales de la Ciudad de Nogales, Sonora, México en cuanto a sus dimensiones, el cual deberá
      ser utilizado de manera exclusiva para la inhumación de los restos de la persona que indique el titular o
      sus representados.
    </div>

    <div class="ubic-tabla">
      <div class="ubic-tabla-int">${ubicacionInterior}</div>
    </div>

    <div class="clausulas">
      ${CLAUSULAS.map((c) => `<div class="clausula"><div class="clausula-bullet">•</div><div class="clausula-texto">${esc(c)}</div></div>`).join("\n")}
    </div>

    <div class="identificacion">
      El titular se identifica con ${identTexto} al momento de la expedición del presente título.
    </div>
    <div class="recibo">No. de Recibo:   ____________________</div>

    <div class="firmas">
      <div class="firma-col">
        <div class="firma-linea">____________________________________</div>
        <div class="firma-nombre">${esc(SINDICO)}</div>
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
