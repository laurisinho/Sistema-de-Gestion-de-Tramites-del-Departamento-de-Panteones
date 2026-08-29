// Script temporal de verificación: crea un lote con historial completo
// (titulo -> cesion, permiso SEP, permiso EXH, reconocimiento), imprime los
// IDs para probar los endpoints, y lo borra todo al final si se le pasa --limpiar.
import { prisma } from "../src/lib/prisma";

async function crear() {
  const panteon = await prisma.panteon.findFirstOrThrow();
  const tipoLote = await prisma.tipoLote.findFirstOrThrow();
  const tipoSep = await prisma.tipoTramite.findFirstOrThrow({ where: { clave: "SEP" } });
  const tipoExh = await prisma.tipoTramite.findFirstOrThrow({ where: { clave: "EXH" } });
  const usuario = await prisma.usuario.findFirstOrThrow();

  const lote = await prisma.lote.create({
    data: {
      panteonId: panteon.panteonId,
      tipoLoteId: tipoLote.tipoLoteId,
      numeroManzana: "TEST-99",
      numeroLote: "TEST-1",
      seccion: "PRUEBA",
      estado: "OCUPADO",
    },
  });

  const titular = await prisma.persona.create({ data: { nombreCompleto: "Titular de Prueba" } });
  const cesionario = await prisma.persona.create({ data: { nombreCompleto: "Cesionario de Prueba" } });
  const solicitante = await prisma.persona.create({ data: { nombreCompleto: "Solicitante de Prueba" } });

  const fallecido1 = await prisma.fallecido.create({ data: { nombreCompleto: "Fallecido Uno de Prueba" } });
  const fallecido2 = await prisma.fallecido.create({ data: { nombreCompleto: "Fallecido Dos de Prueba" } });

  const titulo = await prisma.tituloPropiedad.create({
    data: {
      loteId: lote.loteId,
      titularId: titular.personaId,
      folio: `TEST-TIT-${lote.loteId}`,
      fechaEmision: new Date("2015-03-10"),
      usuarioEmitioId: usuario.usuarioId,
      estado: "CEDIDO",
    },
  });

  const tituloNuevo = await prisma.tituloPropiedad.create({
    data: {
      loteId: lote.loteId,
      titularId: cesionario.personaId,
      folio: `TEST-TIT2-${lote.loteId}`,
      fechaEmision: new Date("2020-06-01"),
      usuarioEmitioId: usuario.usuarioId,
      estado: "VIGENTE",
    },
  });

  await prisma.cesionDerechos.create({
    data: {
      tituloId: tituloNuevo.tituloId,
      loteId: lote.loteId,
      cedenteId: titular.personaId,
      cesionarioId: cesionario.personaId,
      folio: `TEST-CES-${lote.loteId}`,
      fechaCesion: new Date("2020-06-01"),
      usuarioRegistroId: usuario.usuarioId,
    },
  });

  // Fallecido 1: sepultado y luego exhumado -> no debe salir en "ocupantes".
  await prisma.permiso.create({
    data: {
      tipoTramiteId: tipoSep.tipoTramiteId,
      loteId: lote.loteId,
      solicitanteId: solicitante.personaId,
      fallecidoId: fallecido1.fallecidoId,
      folio: `TEST-SEP1-${lote.loteId}`,
      fechaSolicitud: new Date("2016-01-05"),
      usuarioRegistroId: usuario.usuarioId,
    },
  });
  await prisma.permiso.create({
    data: {
      tipoTramiteId: tipoExh.tipoTramiteId,
      loteId: lote.loteId,
      solicitanteId: solicitante.personaId,
      fallecidoId: fallecido1.fallecidoId,
      folio: `TEST-EXH1-${lote.loteId}`,
      fechaSolicitud: new Date("2018-02-20"),
      motivoExhumacion: "Traslado a otro panteón",
      destinoRestos: "Panteón Jardines del Edén",
      usuarioRegistroId: usuario.usuarioId,
    },
  });

  // Fallecido 2: sepultado y sigue ahí -> sí debe salir en "ocupantes".
  await prisma.permiso.create({
    data: {
      tipoTramiteId: tipoSep.tipoTramiteId,
      loteId: lote.loteId,
      solicitanteId: solicitante.personaId,
      fallecidoId: fallecido2.fallecidoId,
      folio: `TEST-SEP2-${lote.loteId}`,
      fechaSolicitud: new Date("2021-09-15"),
      usuarioRegistroId: usuario.usuarioId,
    },
  });

  await prisma.reconocimiento.create({
    data: {
      fallecidoId: fallecido2.fallecidoId,
      loteId: lote.loteId,
      nombreAnterior: "Desconocido de Prueba",
      nombreIdentificado: "Fallecido Dos de Prueba",
      fechaReconocimiento: new Date("2021-09-01"),
      medioIdentificacion: "ADN",
    },
  });

  console.log("Lote de prueba creado. loteId =", lote.loteId);
  console.log("Ocupante esperado: Fallecido Dos de Prueba (NO debe aparecer Fallecido Uno)");
  return lote.loteId;
}

crear()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
