import type { Prisma } from "@prisma/client";
import { LOGO_NOGALES, LOGO_FRONTERA } from "../lib/logos";
import { esc, fechaLarga, fechaHoraCorta } from "../lib/html";

const SINDICO = "MAESTRA EDNA ELINORA SOTO GRACIA";
const GUINDA = "#6B1229";
const GUINDA_DARK = "#4A0C1C";

export type CesionParaPdf = Prisma.CesionDerechosGetPayload<{
  include: { cedente: true; cesionario: true; lote: { include: { panteon: true } } };
}>;

// El título cedido es el del cedente sobre ese lote (para mostrar folio/fecha
// en la carta); si no se encuentra, un objeto mínimo de reserva con folio "—".
export interface TituloCedidoParaPdf {
  folio: string;
  fechaEmision: Date | null;
}

function v(s: string | null | undefined): string {
  return s?.trim() ? s.toUpperCase() : "S/N";
}

export function cesionHtml(
  cesion: CesionParaPdf,
  tituloCedido: TituloCedidoParaPdf,
  opts: { esReimpresion?: boolean; fechaReimpresion?: Date; numeroReimpresion?: number } = {}
): string {
  const lote = cesion.lote;
  const usaColindancias = lote?.numeroManzana === "S/N";
  const { esReimpresion, fechaReimpresion, numeroReimpresion = 0 } = opts;

  const cedente = (cesion.cedente?.nombreCompleto || "").toUpperCase();
  const cesionario = (cesion.cesionario?.nombreCompleto || "").toUpperCase();
  const panteon = (lote?.panteon.nombre || "").toUpperCase();

  const ubicacion = usaColindancias
    ? `CON COLINDANCIAS AL NORTE: ${v(lote?.colindanciaNorte)}, AL SUR: ${v(lote?.colindanciaSur)}, AL ESTE: ${v(lote?.colindanciaEste)}, AL OESTE: ${v(lote?.colindanciaOeste)}`
    : `LOTE NÚMERO ${v(lote?.numeroLote)} SECCIÓN ${v(lote?.seccion)} DE LA MANZANA ${v(lote?.numeroManzana)}`;

  const dom = cesion.cesionario?.domicilio;
  const coln = cesion.cesionario?.colonia;
  const tel = cesion.cesionario?.telefono;
  const domTexto = dom?.trim() ? ` CON DOMICILIO EN ${dom.toUpperCase()}${coln?.trim() ? `, COLONIA ${coln.toUpperCase()}` : ""}` : "";
  const telTexto = tel?.trim() ? ` CON NÚMERO DE TELÉFONO ${tel}` : "";

  const watermark = esReimpresion ? `<div class="watermark">REIMPRESIÓN</div>` : "";
  const reimpresionLinea =
    esReimpresion && fechaReimpresion
      ? `<div class="hdr-reimp">REIMPRESIÓN ${numeroReimpresion > 0 ? `Nº ${numeroReimpresion} ` : ""}— ${fechaHoraCorta(fechaReimpresion)}</div>`
      : "";

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page { size: Letter; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Arial, sans-serif; font-size: 11pt; color: #1a1a1a; }
  .page { width: 8.5in; min-height: 11in; padding: 1.2cm 2cm; display: flex; flex-direction: column; position: relative; }
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
  .hdr-t3 { font-size: 11pt; color: ${GUINDA_DARK}; font-weight: bold; padding-top: 2pt; }
  .hdr-reimp { font-size: 7pt; color: #CC0000; font-weight: bold; padding-top: 2pt; }
  .hdr-rule { border-top: 2pt solid ${GUINDA}; margin-top: 3pt; }
  .hdr-folio-fecha { display: flex; padding-top: 2pt; }
  .hdr-folio { flex: 1; font-size: 9pt; }
  .hdr-folio span { color: #777777; font-size: 8pt; }
  .hdr-fecha { flex: 1; text-align: right; font-size: 9pt; }

  .contenido { flex: 1; padding-top: 8pt; z-index: 1; }
  .destinatario { padding-top: 10pt; }
  .destinatario-nombre { font-weight: bold; font-size: 11pt; }
  .destinatario-cargo { font-size: 10pt; color: ${GUINDA}; }
  .destinatario-presente { padding-top: 2pt; font-size: 10pt; }

  .intro { padding-top: 12pt; font-size: 11pt; }
  .parrafo { padding-top: 10pt; font-size: 11pt; line-height: 1.5; text-align: justify; }

  .firmas { padding-top: 45pt; text-align: center; font-weight: bold; font-size: 11pt; }
  .firmas-row { padding-top: 35pt; display: flex; }
  .firma-col { flex: 1; text-align: center; }
  .firma-sep { width: 30pt; }
  .firma-linea { font-size: 10pt; }
  .firma-nombre { padding-top: 2pt; font-weight: bold; font-size: 10pt; }
  .firma-cargo { font-size: 8pt; color: ${GUINDA}; }

  .pie { text-align: center; font-size: 7pt; color: #999999; z-index: 1; }
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
      <div class="hdr-t3">CESIÓN DE DERECHOS DE LOTE</div>
      ${reimpresionLinea}
    </div>
    <div class="hdr-logo-right"><img src="${LOGO_FRONTERA}" /></div>
  </div>
  <div class="hdr-rule"></div>
  <div class="hdr-folio-fecha">
    <div class="hdr-folio"><span>Folio: </span><strong>${esc(cesion.folio)}</strong></div>
    <div class="hdr-fecha">H. Nogales, Sonora a ${fechaLarga(cesion.fechaCesion)}.</div>
  </div>

  <div class="contenido">
    <div class="destinatario">
      <div class="destinatario-nombre">${esc(SINDICO)}</div>
      <div class="destinatario-cargo">SÍNDICO MUNICIPAL — H. NOGALES, SONORA.</div>
      <div class="destinatario-presente">P R E S E N T E.</div>
    </div>

    <div class="intro">Por medio del presente me permito informar y solicitar a usted lo siguiente:</div>

    <div class="parrafo">
      Yo <strong>${esc(cedente)}</strong>, titular del ${esc(ubicacion)} en el Panteón <strong>${esc(panteon)}</strong>,
      tal y como lo acredito con el Título de Propiedad número <strong>${esc(tituloCedido.folio)}</strong>${tituloCedido.fechaEmision ? ` de fecha ${fechaLarga(tituloCedido.fechaEmision)}` : ""},
      es mi deseo y voluntad ceder los derechos del lote mencionado con antelación a favor de <strong>${esc(cesionario)}</strong>${esc(domTexto)}${esc(telTexto)},
      no existiendo inconveniente alguno para que se le expida un título a su favor.
    </div>

    <div class="parrafo">
      Renunciando voluntariamente a todo derecho sobre el mencionado lote, no teniendo derecho a reclamar nada
      sobre dicha propiedad en el futuro. Esperando atienda mi petición, anticipo las gracias por su atención.
    </div>

    <div class="firmas">A T E N T A M E N T E</div>
    <div class="firmas-row">
      <div class="firma-col">
        <div class="firma-linea">__________________________________</div>
        <div class="firma-nombre">${esc(cedente)}</div>
        <div class="firma-cargo">EL CEDENTE</div>
      </div>
      <div class="firma-sep"></div>
      <div class="firma-col">
        <div class="firma-linea">__________________________________</div>
        <div class="firma-nombre">${esc(cesionario)}</div>
        <div class="firma-cargo">ACEPTO DE CONFORMIDAD — EL CESIONARIO</div>
      </div>
    </div>
  </div>

  <div class="pie">Departamento de Control de Panteones — H. Ayuntamiento de Nogales, Sonora</div>
</div>
</body>
</html>`;
}
