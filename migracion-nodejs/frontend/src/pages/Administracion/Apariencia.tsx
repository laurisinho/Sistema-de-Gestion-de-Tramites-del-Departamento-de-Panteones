import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, API_URL, ApiError } from "../../lib/api";
import { aplicarApariencia, APARIENCIA_DEFAULT } from "../../lib/colores";

interface Apariencia {
  colorGuinda: string;
  colorDorado: string;
  nombreSindico: string;
}

const SINDICO_DEFAULT = "MAESTRA EDNA ELINORA SOTO GRACIA";

// Las tres tarjetas de esta pantalla comparten ancho para que sus bordes
// queden alineados en vez de la escalinata que dejaban 520/640/520px sueltos.
const ANCHO_TARJETA = 640;

function archivoADataUri(archivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve(lector.result as string);
    lector.onerror = () => reject(lector.error);
    lector.readAsDataURL(archivo);
  });
}

export function AdministracionApariencia() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["apariencia"],
    queryFn: () => api<Apariencia>("/apariencia"),
  });

  const [colorGuinda, setColorGuinda] = useState(APARIENCIA_DEFAULT.colorGuinda);
  const [colorDorado, setColorDorado] = useState(APARIENCIA_DEFAULT.colorDorado);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState(false);

  // Arranca con lo ya guardado; si cambia en otra pestaña o sesión se refleja
  // aquí, sin pisar lo que el usuario esté probando.
  useEffect(() => {
    if (data) {
      setColorGuinda(data.colorGuinda);
      setColorDorado(data.colorDorado);
    }
  }, [data]);

  // Vista previa real: cambia toda la página al instante, no solo esta pantalla.
  // Solo guardar lo hace permanente para todos.
  useEffect(() => {
    aplicarApariencia(colorGuinda, colorDorado);
  }, [colorGuinda, colorDorado]);

  const guardar = useMutation({
    mutationFn: () => api<Apariencia>("/administracion/apariencia", { method: "PUT", body: JSON.stringify({ colorGuinda, colorDorado }) }),
    onSuccess: (config) => {
      queryClient.setQueryData(["apariencia"], config);
      setError(null);
      setExito(true);
      setTimeout(() => setExito(false), 3000);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "No se pudo guardar"),
  });

  function restablecer() {
    setColorGuinda(APARIENCIA_DEFAULT.colorGuinda);
    setColorDorado(APARIENCIA_DEFAULT.colorDorado);
  }

  const sinCambios = data?.colorGuinda === colorGuinda && data?.colorDorado === colorDorado;

  return (
    <div>
      <div className="page-header">
        <h2>
          <i className="bi bi-palette" />
          Apariencia
        </h2>
      </div>
      <p className="text-muted" style={{ fontSize: 13, marginTop: -8 }}>
        Los dos colores de marca del sistema. Se aplican para todos en cuanto se guardan; el modo claro/oscuro de
        cada quien sigue siendo aparte.
      </p>

      <div className="card" style={{ maxWidth: ANCHO_TARJETA }}>
        <div className="card-header-guinda">
          <span>
            <i className="bi bi-eyedropper" /> Colores del sistema
          </span>
        </div>
        <div className="card-body">
          {isLoading && <p>Cargando...</p>}
          <div className="form-grid una-col">
            <div className="form-campo">
              <label>Guinda (color primario)</label>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <input
                  type="color"
                  value={colorGuinda}
                  onChange={(e) => setColorGuinda(e.target.value)}
                  style={{ width: 44, height: 36, padding: 2, cursor: "pointer" }}
                />
                <input
                  value={colorGuinda}
                  onChange={(e) => setColorGuinda(e.target.value)}
                  className="font-monospace"
                  style={{ maxWidth: 120 }}
                  maxLength={7}
                />
              </div>
            </div>
            <div className="form-campo">
              <label>Dorado (acento)</label>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <input
                  type="color"
                  value={colorDorado}
                  onChange={(e) => setColorDorado(e.target.value)}
                  style={{ width: 44, height: 36, padding: 2, cursor: "pointer" }}
                />
                <input
                  value={colorDorado}
                  onChange={(e) => setColorDorado(e.target.value)}
                  className="font-monospace"
                  style={{ maxWidth: 120 }}
                  maxLength={7}
                />
              </div>
            </div>
          </div>

          {error && (
            <p className="aviso-error" style={{ marginTop: 12, marginBottom: 0 }}>
              {error}
            </p>
          )}
          {exito && (
            <p className="aviso-exito" style={{ marginTop: 12, marginBottom: 0 }}>
              Colores guardados.
            </p>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button className="boton" onClick={() => guardar.mutate()} disabled={guardar.isPending || sinCambios}>
              <i className="bi bi-check-circle" /> {guardar.isPending ? "Guardando..." : "Guardar"}
            </button>
            <button type="button" className="boton-secundario" onClick={restablecer}>
              <i className="bi bi-arrow-counterclockwise" /> Restablecer a los originales
            </button>
          </div>
        </div>
      </div>

      <LogosCard />
      <SindicoCard nombreGuardado={data?.nombreSindico} />
    </div>
  );
}

// Logos

function LogoFila({ cual, etiqueta }: { cual: "nogales" | "frontera"; etiqueta: string }) {
  const [version, setVersion] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onArchivoElegido(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    setError(null);
    setSubiendo(true);
    try {
      const dataUri = await archivoADataUri(archivo);
      await api(`/administracion/apariencia/logo/${cual}`, { method: "PUT", body: JSON.stringify({ dataUri }) });
      setVersion((v) => v + 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo subir el logo");
    } finally {
      setSubiendo(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function restablecer() {
    setError(null);
    setSubiendo(true);
    try {
      await api(`/administracion/apariencia/logo/${cual}/restablecer`, { method: "POST" });
      setVersion((v) => v + 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo restablecer");
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
      <img
        src={`${API_URL}/apariencia/logo/${cual}?v=${version}`}
        alt={etiqueta}
        style={{ height: 48, maxWidth: 140, objectFit: "contain", background: "#fff", borderRadius: 6, padding: 4 }}
      />
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 13.5 }}>{etiqueta}</div>
        {error && <p className="aviso-error" style={{ margin: "4px 0 0", fontSize: 12.5 }}>{error}</p>}
      </div>
      <button type="button" className="boton-secundario boton-sm" onClick={() => inputRef.current?.click()} disabled={subiendo}>
        <i className="bi bi-upload" /> {subiendo ? "Subiendo..." : "Cambiar"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/png"
        onChange={onArchivoElegido}
        disabled={subiendo}
        style={{ display: "none" }}
      />
      <button type="button" className="boton-secundario boton-sm" onClick={restablecer} disabled={subiendo} title="Restablecer al original">
        <i className="bi bi-arrow-counterclockwise" />
      </button>
    </div>
  );
}

function LogosCard() {
  return (
    <div className="card" style={{ maxWidth: ANCHO_TARJETA }}>
      <div className="card-header-guinda">
        <span>
          <i className="bi bi-images" /> Logos en documentos y reportes
        </span>
      </div>
      <div className="card-body">
        <p className="text-muted" style={{ fontSize: 12.5, marginTop: 0 }}>
          Aparecen en los títulos, permisos, cesiones (PDF) y en los reportes Excel. Solo se aceptan archivos PNG.
        </p>
        <LogoFila cual="nogales" etiqueta="Escudo de Nogales" />
        <LogoFila cual="frontera" etiqueta="Frontera de Todos" />
      </div>
    </div>
  );
}

// Síndico municipal

function SindicoCard({ nombreGuardado }: { nombreGuardado: string | undefined }) {
  const queryClient = useQueryClient();
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState(false);

  useEffect(() => {
    if (nombreGuardado !== undefined) setNombre(nombreGuardado);
  }, [nombreGuardado]);

  const guardar = useMutation({
    mutationFn: () => api<{ nombreSindico: string }>("/administracion/apariencia/sindico", { method: "PUT", body: JSON.stringify({ nombreSindico: nombre }) }),
    onSuccess: (r) => {
      queryClient.setQueryData(["apariencia"], (prev: Apariencia | undefined) => (prev ? { ...prev, nombreSindico: r.nombreSindico } : prev));
      setError(null);
      setExito(true);
      setTimeout(() => setExito(false), 3000);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "No se pudo guardar"),
  });

  return (
    <div className="card" style={{ maxWidth: ANCHO_TARJETA }}>
      <div className="card-header-guinda">
        <span>
          <i className="bi bi-person-badge" /> Síndico Municipal
        </span>
      </div>
      <div className="card-body">
        <p className="text-muted" style={{ fontSize: 12.5, marginTop: 0 }}>
          Nombre de quien firma títulos, permisos y cesiones. Cambia con cada administración.
        </p>
        <div className="form-campo">
          <label>Nombre completo</label>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder={SINDICO_DEFAULT} />
        </div>

        {error && (
          <p className="aviso-error" style={{ marginTop: 12, marginBottom: 0 }}>
            {error}
          </p>
        )}
        {exito && (
          <p className="aviso-exito" style={{ marginTop: 12, marginBottom: 0 }}>
            Guardado.
          </p>
        )}

        <div style={{ marginTop: 16 }}>
          <button
            className="boton"
            onClick={() => guardar.mutate()}
            disabled={guardar.isPending || !nombre.trim() || nombre === nombreGuardado}
          >
            <i className="bi bi-check-circle" /> {guardar.isPending ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
