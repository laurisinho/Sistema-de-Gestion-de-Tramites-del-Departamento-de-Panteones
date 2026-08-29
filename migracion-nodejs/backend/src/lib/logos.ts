import fs from "node:fs";
import path from "node:path";

function dataUri(nombreArchivo: string): string {
  const ruta = path.join(__dirname, "..", "assets", nombreArchivo);
  const buffer = fs.readFileSync(ruta);
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

export const LOGO_NOGALES = dataUri("logo_nogales.png");
export const LOGO_FRONTERA = dataUri("logo_frontera.png");
