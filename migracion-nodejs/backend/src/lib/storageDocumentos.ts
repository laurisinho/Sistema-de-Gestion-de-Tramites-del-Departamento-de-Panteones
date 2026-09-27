import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// El bucket vive en Supabase Storage, aparte de la base de datos (que ya usa
// Supabase Postgres). Es privado: nadie descarga un archivo sin pasar por
// nuestra API, que ya exige sesión.
const BUCKET = "documentos-lotes";

// Deliberadamente no pasa por lib/env.ts: ese módulo revienta al importarse si
// falta una variable (ver JWT_SECRET), y env.ts lo arrastran módulos que ni
// tocan documentos (como lib/pdf.ts). Aquí se valida solo cuando de verdad se
// usa, para no tumbar el resto del API si aún no se configura Supabase Storage.
let cliente: SupabaseClient | null = null;

function obtenerCliente(): SupabaseClient {
  if (cliente) return cliente;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Falta configurar SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY para documentos escaneados.");
  }
  cliente = createClient(url, key, { auth: { persistSession: false } });
  return cliente;
}

export async function subirDocumento(ruta: string, bytes: Buffer, tipoMime: string): Promise<void> {
  const { error } = await obtenerCliente().storage.from(BUCKET).upload(ruta, bytes, { contentType: tipoMime, upsert: false });
  if (error) throw new Error(`No se pudo subir el archivo: ${error.message}`);
}

export async function descargarDocumento(ruta: string): Promise<Buffer> {
  const { data, error } = await obtenerCliente().storage.from(BUCKET).download(ruta);
  if (error || !data) throw new Error(`No se pudo descargar el archivo: ${error?.message ?? "desconocido"}`);
  return Buffer.from(await data.arrayBuffer());
}

export async function eliminarDocumento(ruta: string): Promise<void> {
  const { error } = await obtenerCliente().storage.from(BUCKET).remove([ruta]);
  if (error) throw new Error(`No se pudo eliminar el archivo: ${error.message}`);
}
