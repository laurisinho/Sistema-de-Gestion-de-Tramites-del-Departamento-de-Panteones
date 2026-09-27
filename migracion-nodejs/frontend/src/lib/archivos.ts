// Compartido por Apariencia (logos) y el expediente del lote (documentos
// escaneados): ambos suben el archivo como data URI base64 dentro del cuerpo
// JSON de la petición, en vez de multipart/form-data.
export function archivoADataUri(archivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve(lector.result as string);
    lector.onerror = () => reject(lector.error);
    lector.readAsDataURL(archivo);
  });
}

export function formatoBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
