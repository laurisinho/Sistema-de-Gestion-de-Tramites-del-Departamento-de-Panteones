import type { Prisma } from "@prisma/client";
import { LOGO_NOGALES, LOGO_FRONTERA } from "../lib/logos";
import { esc, fechaLargaMayus, esFechaReal, fechaHoraCorta, fechaCorta } from "../lib/html";

const SINDICO = "MAESTRA EDNA ELINORA SOTO GRACIA";
const GUINDA = "#6B1229";
const GUINDA_DARK = "#4A0C1C";
const DORADO = "#F5B400";
const GRIS_CLARO = "#F5F5F5";

export type PermisoParaPdf = Prisma.PermisoGetPayload<{
  include: { tipoTramite: true; solicitante: true; fallecido: true; lote: { include: { panteon: true } } };
}>;

function nombreTipo(clave: string): string {
  switch (clave) {
    case "SEP":
      return "INHUMACIÓN";
    case "EXH":
      return "EXHUMACIÓN";
    case "CEN":
      return "DEPÓSITO DE CENIZAS";
    case "CON":
      return "CONSTRUCCIÓN";
    default:
      return clave;
  }
}

// Puerto exacto de TextosCuerpo: arma las líneas de cuerpo según el tipo de trámite.
function textosCuerpo(p: PermisoParaPdf, tipo: string): string[] {
  const sinCosto = p.esDonacion && !p.numeroRecibo?.trim();
  const concepto = sinCosto
    ? "mediante recibo: SERVICIO SOCIAL SIN COSTO"
    : `previo pago de derechos mediante recibo No. ${p.numeroRecibo ?? "______"} expedido por la Tesorería Municipal`;

  const INDICADOR = "Favor de colocar un indicador personal en el lote para evitar confusiones futuras.";
  const lineas: string[] = [];

  switch (tipo) {
    case "SEP":
      lineas.push(`Se concede el presente permiso de INHUMACIÓN a solicitud del interesado, ${concepto}.`);
      if (p.esDonacion) lineas.push("El lote ha sido donado por el H. Ayuntamiento de Nogales, Sonora.");
      lineas.push(INDICADOR);
      break;
    case "EXH":
      lineas.push(`Se concede el presente permiso de EXHUMACIÓN a solicitud del interesado, ${concepto}.`);
      if (p.motivoExhumacion?.trim()) lineas.push(`Motivo de la exhumación: ${p.motivoExhumacion}.`);
      if (p.destinoRestos?.trim()) lineas.push(`Destino de los restos: ${p.destinoRestos}.`);
      lineas.push(INDICADOR);
      break;
    case "CEN":
      lineas.push(`Se concede el presente permiso para DEPÓSITO DE CENIZAS a solicitud del interesado, ${concepto}.`);
      lineas.push(INDICADOR);
      break;
    case "CON":
      if (p.tipoObra?.trim()) lineas.push(`Tipo de construcción: ${p.tipoObra.toUpperCase()}.`);
      if (p.descripcionObra?.trim()) lineas.push(`Descripción de la obra: ${p.descripcionObra}.`);
      lineas.push(`Se concede el presente permiso de CONSTRUCCIÓN a solicitud del interesado, ${concepto}.`);
      break;
  }
  return lineas;
}

function filaDato(etiqueta: string, valor: string): string {
  return `<div class="fila-dato"><span class="fd-et">${esc(etiqueta)}: </span><span class="fd-val">${esc(valor)}</span></div>`;
}

export function permisoHtml(
  permiso: PermisoParaPdf,
  opts: { esReimpresion?: boolean; fechaReimpresion?: Date; numeroReimpresion?: number } = {}
): string {
  const tipo = permiso.tipoTramite.clave;
  const usaColindancias = permiso.lote?.numeroManzana === "S/N";
  const { esReimpresion, fechaReimpresion, numeroReimpresion = 0 } = opts;

  const datosGeneralesFilas: string[] = [];
  if (permiso.fallecido) {
    if (permiso.fallecido.numeroCaso?.trim()) {
      datosGeneralesFilas.push(filaDato("Núm. único de caso", permiso.fallecido.numeroCaso));
    }
  }
  if (permiso.funeraria?.trim()) datosGeneralesFilas.push(filaDato("Funeraria", permiso.funeraria.toUpperCase()));
  if (permiso.tipoObra?.trim()) datosGeneralesFilas.push(filaDato("Tipo de construcción", permiso.tipoObra.toUpperCase()));
  if (permiso.numeroRecibo?.trim() && !permiso.esDonacion) datosGeneralesFilas.push(filaDato("Recibo No.", permiso.numeroRecibo));
  if (permiso.esDonacion) datosGeneralesFilas.push(filaDato("Concepto", "LOTE DONADO POR EL H. AYUNTAMIENTO"));

  const ubicacionInterior = usaColindancias
    ? `<div class="ubic-row">
         <div><div class="ubic-simple"><span class="us-et">Norte: </span><span class="us-val">${esc((permiso.lote?.colindanciaNorte || "—").toUpperCase())}</span></div>
              <div class="ubic-simple"><span class="us-et">Este: </span><span class="us-val">${esc((permiso.lote?.colindanciaEste || "—").toUpperCase())}</span></div></div>
         <div><div class="ubic-simple"><span class="us-et">Sur: </span><span class="us-val">${esc((permiso.lote?.colindanciaSur || "—").toUpperCase())}</span></div>
              <div class="ubic-simple"><span class="us-et">Oeste: </span><span class="us-val">${esc((permiso.lote?.colindanciaOeste || "—").toUpperCase())}</span></div></div>
       </div>`
    : `<div class="ubic-row3">
         <div><div class="ubic-label">Sección</div><div class="ubic-valor">${esc((permiso.lote?.seccion || "S/N").toUpperCase())}</div></div>
         <div><div class="ubic-label">Manzana</div><div class="ubic-valor">${esc((permiso.lote?.numeroManzana || "").toUpperCase())}</div></div>
         <div><div class="ubic-label">Lote</div><div class="ubic-valor">${esc(permiso.lote?.numeroLote ?? "")}</div></div>
       </div>`;

  const avisoAlturaMaxima =
    tipo === "CON"
      ? `<div class="aviso-linea"><span class="av-et">Altura máxima: </span>1.20 m (barda o barandal). Vigencia: un mes.</div>`
      : "";

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
  .page { width: 8.5in; min-height: 11in; padding: 1cm 1.5cm; display: flex; flex-direction: column; position: relative; }
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

  .contenido { flex: 1; padding-top: 5pt; z-index: 1; }

  .tipo-permiso {
    text-align: center; background: ${GUINDA}; color: #fff; font-weight: bold; font-size: 12pt;
    padding: 5pt 25pt; margin: 6pt auto 4pt; display: table;
  }

  .datos-generales {
    margin-top: 4pt; background: ${GRIS_CLARO}; border: 0.5pt solid #DDDDDD; padding: 8pt;
  }
  .dg-row { display: flex; gap: 12pt; }
  .dg-row > div { flex: 1; }
  .fila-dato { padding-bottom: 1pt; }
  .fd-et { font-size: 9pt; color: #555555; }
  .fd-val { font-size: 10pt; font-weight: bold; }

  .ubicacion { padding-top: 6pt; }
  .ubic-titulo { font-weight: bold; font-size: 10pt; color: ${GUINDA_DARK}; padding-bottom: 3pt; }
  .ubic-tabla { border: 0.5pt solid #DDDDDD; }
  .ubic-panteon { background: ${GUINDA}; color: #fff; font-weight: bold; font-size: 10pt; padding: 4pt 8pt; }
  .ubic-row, .ubic-row3 { display: flex; padding: 6pt; gap: 12pt; }
  .ubic-row > div, .ubic-row3 > div { flex: 1; }
  .ubic-simple { padding-bottom: 2pt; }
  .us-et { font-size: 9pt; color: #777777; }
  .us-val { font-size: 10pt; font-weight: bold; }
  .ubic-label { font-size: 8pt; color: #777777; }
  .ubic-valor { font-size: 11pt; font-weight: bold; }

  .cuerpo { padding-top: 8pt; }
  .cuerpo-linea { padding-bottom: 3pt; font-size: 10.5pt; line-height: 1.25; }
  .no-acredita {
    margin-top: 4pt; background: #FFF8E1; border: 0.5pt solid ${DORADO}; padding: 5pt;
    font-weight: bold; font-size: 9pt; color: ${GUINDA_DARK};
  }

  .autorizacion { text-align: center; padding-top: 55pt; }
  .aut-linea { font-size: 11pt; }
  .aut-nombre { padding-top: 3pt; font-weight: bold; font-size: 11pt; }
  .aut-cargo { padding-top: 1pt; font-size: 9.5pt; color: ${GUINDA}; }
  .aut-lugar { font-size: 8.5pt; color: #777777; }

  .pie { z-index: 1; }
  .pie-rule { border-top: 1pt solid ${GUINDA}; }
  .avisos { padding-top: 6pt; }
  .aviso-linea { padding-top: 2pt; font-size: 9.5pt; }
  .aviso-linea:first-child { padding-top: 0; }
  .av-et { font-weight: bold; color: ${GUINDA_DARK}; }

  .acuse { padding-top: 6pt; display: flex; }
  .acuse-izq { flex: 3; }
  .acuse-der { flex: 2; padding-top: 8pt; padding-left: 14pt; }
  .acuse-titulo { font-weight: bold; font-size: 10pt; color: ${GUINDA_DARK}; }
  .acuse-linea { padding-top: 3pt; font-size: 10pt; }
  .acuse-firma-linea { border-bottom: 0.8pt solid #666666; padding-top: 16pt; }
  .acuse-firma-texto { text-align: center; font-size: 9.5pt; color: #777777; padding-top: 2pt; }
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
    <div class="tipo-permiso">PERMISO DE ${esc(nombreTipo(tipo))}</div>

    <div class="datos-generales">
      <div class="dg-row">
        <div>
          ${filaDato("Folio", permiso.folio)}
          ${filaDato("Fecha", fechaLargaMayus(permiso.fechaSolicitud))}
        </div>
        <div>
          ${filaDato("Solicitante", (permiso.solicitante.nombreCompleto || "").toUpperCase())}
          ${permiso.solicitante.telefono ? filaDato("Tel", permiso.solicitante.telefono) : ""}
        </div>
      </div>
      ${
        permiso.fallecido
          ? `<div class="dg-row" style="padding-top:3pt">
               <div>${filaDato("Difunto", permiso.fallecido.nombreCompleto.toUpperCase())}</div>
               <div>${esFechaReal(permiso.fallecido.fechaFallecimiento) ? filaDato("Fecha fallecimiento", fechaCorta(permiso.fallecido.fechaFallecimiento)) : ""}</div>
             </div>`
          : ""
      }
      ${datosGeneralesFilas.join("\n")}
    </div>

    <div class="ubicacion">
      <div class="ubic-titulo">UBICACIÓN DEL LOTE</div>
      <div class="ubic-tabla">
        <div class="ubic-panteon">Panteón: ${esc((permiso.lote?.panteon.nombre || "").toUpperCase())}</div>
        ${ubicacionInterior}
      </div>
    </div>

    <div class="cuerpo">
      ${textosCuerpo(permiso, tipo)
        .map((l) => `<div class="cuerpo-linea">${esc(l)}</div>`)
        .join("\n")}
      <div class="no-acredita">Este documento NO acredita propiedad del lote.</div>
    </div>

    <div class="autorizacion">
      <div class="aut-linea">____________________________________</div>
      <div class="aut-nombre">${esc(SINDICO)}</div>
      <div class="aut-cargo">SÍNDICO MUNICIPAL</div>
      <div class="aut-lugar">H. Ayuntamiento de Nogales, Sonora</div>
    </div>
  </div>

  <div class="pie">
    <div class="pie-rule"></div>
    <div class="avisos">
      <div class="aviso-linea"><span class="av-et">Limpieza: </span>El área de trabajo deberá quedar limpia. Los escombros serán retirados de manera inmediata. El incumplimiento será sancionado.</div>
      <div class="aviso-linea"><span class="av-et">Horarios: </span>Panteones 8:00 AM - 5:00 PM. Oficina y permisos: 8:00 AM - 3:00 PM, Lunes a Viernes.</div>
      ${avisoAlturaMaxima}
    </div>
    <div class="acuse">
      <div class="acuse-izq">
        <div class="acuse-titulo">ACUSE DE RECIBO</div>
        <div class="acuse-linea">Nombre: <strong>C. ${esc((permiso.solicitante.nombreCompleto || "").toUpperCase())}</strong></div>
        ${permiso.solicitante.telefono ? `<div class="acuse-linea">Tel: <strong>${esc(permiso.solicitante.telefono)}</strong></div>` : ""}
      </div>
      <div class="acuse-der">
        <div class="acuse-firma-linea"></div>
        <div class="acuse-firma-texto">Firma del solicitante</div>
      </div>
    </div>
  </div>
</div>
</body>
</html>`;
}
