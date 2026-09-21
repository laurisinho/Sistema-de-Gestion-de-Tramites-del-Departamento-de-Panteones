import { getToken, clearToken } from "./token";

export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(ruta: string, opciones: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${ruta}`, {
    ...opciones,
    credentials: "include", // útil en local (mismo origen); en producción la autenticación va por el header de abajo
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opciones.headers,
    },
  });

  // Un 401 fuera del flujo de login significa que la sesión expiró o el servidor
  // la invalidó. El original lo resuelve porque cada navegación es una petición
  // nueva; aquí, sin este redirect, la SPA se quedaría mostrando una pantalla
  // rota con errores 401 silenciosos en lugar de enviar a /login.
  if (res.status === 401 && !ruta.startsWith("/auth/")) {
    clearToken();
    // Con HashRouter la app siempre vive en BASE_URL/index.html; la ruta real la
    // define lo que va después de "#".
    window.location.href = `${import.meta.env.BASE_URL}#/login`;
    return new Promise<T>(() => {});
  }

  const cuerpo = await res.json().catch(() => null);

  if (!res.ok) {
    throw new ApiError(res.status, cuerpo?.error ?? "Error de comunicación con el servidor");
  }

  return cuerpo as T;
}

// El diálogo nativo de "Guardar como" (File System Access API) es la única forma
// de que el usuario elija dónde guardar un archivo. Solo lo soportan los
// navegadores Chromium (Chrome, Edge, Brave); en Firefox y Safari la función no
// existe. El navegador recuerda la última carpeta usada por el sitio.
interface DestinoGuardado {
  createWritable(): Promise<{ write(datos: Blob): Promise<void>; close(): Promise<void> }>;
}

// Sin esto el diálogo no sabe qué extensión proponer y muestra "Todos los
// archivos", con lo que los reportes se guardaban sin .xlsx y Windows no los
// abría con Excel.
function tiposParaExtension(nombre: string): { description: string; accept: Record<string, string[]> }[] | undefined {
  const ext = nombre.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return [{ description: "PDF", accept: { "application/pdf": [".pdf"] } }];
  if (ext === "xlsx") {
    return [{ description: "Excel", accept: { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"] } }];
  }
  return undefined;
}

async function elegirDestinoGuardado(nombreSugerido: string): Promise<DestinoGuardado | null> {
  const showSaveFilePicker = (window as unknown as {
    showSaveFilePicker?: (opciones: {
      suggestedName: string;
      types?: { description: string; accept: Record<string, string[]> }[];
    }) => Promise<DestinoGuardado>;
  }).showSaveFilePicker;
  if (!showSaveFilePicker) return null;
  return showSaveFilePicker({ suggestedName: nombreSugerido, types: tiposParaExtension(nombreSugerido) });
}

// Vista previa incrustada en la misma página en lugar de una pestaña nueva:
// window.open() y showSaveFilePicker() consumen la activación del clic (solo una
// de las dos tiene éxito por cada clic, sin importar el orden), así que no se
// pueden ofrecer ambas con window.open(). Un <iframe> no depende de esa
// activación ni se bloquea como popup, por lo que convive con "Guardar como".
function mostrarVistaPrevia(blob: Blob): void {
  const url = URL.createObjectURL(blob);

  const fondo = document.createElement("div");
  fondo.style.cssText =
    "position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.65);display:flex;flex-direction:column;padding:16px;box-sizing:border-box;";

  const cerrar = () => {
    fondo.remove();
    document.removeEventListener("keydown", alPresionarTecla);
    URL.revokeObjectURL(url);
  };
  const alPresionarTecla = (e: KeyboardEvent) => {
    if (e.key === "Escape") cerrar();
  };
  document.addEventListener("keydown", alPresionarTecla);

  const barra = document.createElement("div");
  barra.style.cssText = "display:flex;justify-content:flex-end;margin-bottom:8px;";
  const boton = document.createElement("button");
  boton.type = "button";
  boton.textContent = "Cerrar ✕";
  boton.style.cssText = "cursor:pointer;padding:8px 16px;border:0;border-radius:4px;background:#fff;font-weight:600;";
  boton.onclick = cerrar;
  barra.appendChild(boton);

  const marco = document.createElement("iframe");
  marco.src = url;
  marco.title = "Vista previa del documento";
  marco.style.cssText = "flex:1;width:100%;border:0;border-radius:4px;background:#fff;";

  fondo.appendChild(barra);
  fondo.appendChild(marco);
  document.body.appendChild(fondo);
}

// Los botones de imprimir eran <a href> directos a la API: una navegación de
// enlace no puede llevar el header Authorization y dependía de la cookie, que
// los navegadores con protección de privacidad bloquean entre sitios distintos.
// Ahora se descarga por JS con el mismo token que usa el resto de la app.
export async function descargarArchivo(
  ruta: string,
  nombreRespaldo = "documento",
  opciones: { verEnNavegador?: boolean } = {}
): Promise<void> {
  let destino: DestinoGuardado | null = null;
  let cancelado = false;
  try {
    destino = await elegirDestinoGuardado(nombreRespaldo);
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      cancelado = true; // el usuario cerró el diálogo sin elegir nada
    }
    // cualquier otro problema (permiso denegado, etc.) -> sigue como descarga normal
  }

  // Cancelar "Guardar como" solo cancela todo el proceso cuando era la única forma
  // de obtener el archivo (p. ej. un Excel). Si además se pidió vista previa
  // (imprimir), lo más probable es que solo quisiera verlo o imprimirlo, así que
  // se continúa con la vista previa.
  if (cancelado && !opciones.verEnNavegador) return;

  const token = getToken();
  const res = await fetch(`${API_URL}${ruta}`, {
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) {
    const cuerpo = await res.json().catch(() => null);
    throw new ApiError(res.status, cuerpo?.error ?? "No se pudo generar el documento");
  }

  const blob = await res.blob();

  if (opciones.verEnNavegador) mostrarVistaPrevia(blob);
  if (cancelado) return;

  if (destino) {
    const escritura = await destino.createWritable();
    await escritura.write(blob);
    await escritura.close();
    return;
  }

  // Las rutas de descarga ya mandan el nombre real en Content-Disposition;
  // el respaldo solo aplica si por algo faltara.
  const nombreServidor = res.headers.get("Content-Disposition")?.match(/filename="?([^"]+)"?/)?.[1];
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombreServidor ?? nombreRespaldo;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
}
