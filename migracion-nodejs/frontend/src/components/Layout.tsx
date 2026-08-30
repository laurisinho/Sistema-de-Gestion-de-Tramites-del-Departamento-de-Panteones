import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import logoNogales from "../assets/logo_nogales.png";
import "./layout.css";

interface Enlace {
  to: string;
  label: string;
  icono?: string;
  sub?: boolean;
  soloAdmin?: boolean;
}

const GRUPOS: { titulo: string; enlaces: Enlace[] }[] = [
  {
    titulo: "Consulta",
    enlaces: [
      { to: "/titulos", label: "Expedientes", icono: "bi-folder2" },
      { to: "/permisos", label: "Buscar Permisos", sub: true },
      { to: "/lotes", label: "Expediente de lote", icono: "bi-clock-history" },
    ],
  },
  {
    titulo: "Trámites",
    enlaces: [
      { to: "/permisos", label: "Permisos", icono: "bi-file-earmark-plus" },
      { to: "/titulos", label: "Títulos de Propiedad", icono: "bi-award" },
      { to: "/cesiones", label: "Cesión de Derechos", icono: "bi-arrow-left-right" },
      { to: "/reimpresiones", label: "Reimpresiones", icono: "bi-printer" },
    ],
  },
  {
    titulo: "Operación",
    enlaces: [
      { to: "/incidencias", label: "Incidencias", icono: "bi-exclamation-triangle" },
      { to: "/reportes", label: "Reportes", icono: "bi-file-earmark-bar-graph" },
    ],
  },
  {
    titulo: "Administración",
    enlaces: [
      { to: "/usuarios", label: "Usuarios", icono: "bi-people", soloAdmin: true },
      { to: "/bitacora", label: "Bitácora", icono: "bi-journal-text" },
    ],
  },
];

const HIJOS_NO_RECLAMADOS = [
  { to: "/no-reclamados", label: "Listado", icono: "bi-list-ul", exacto: true },
  { to: "/no-reclamados/reconocidos", label: "Identificadas", icono: "bi-person-check" },
  { to: "/no-reclamados/lotes-disponibles", label: "Lotes disponibles", icono: "bi-grid-3x3-gap" },
];

function iniciales(nombre: string | undefined): string {
  if (!nombre) return "?";
  const partes = nombre.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase();
}

// Equivale a ViewData["Title"] del original: cada vista .cshtml lo fijaba y
// _Layout.cshtml lo mostraba en la topbar y en <title>. Aquí no hay ViewData,
// así que se deriva de la ruta -- del más específico al más genérico.
function tituloDePagina(pathname: string): string {
  if (pathname === "/") return "Panel Principal";
  if (pathname.endsWith("/expediente")) return "Expediente del lote";
  if (pathname === "/lotes") return "Expediente de lote";
  if (pathname === "/permisos/nuevo") return "Nuevo Permiso";
  if (pathname.startsWith("/permisos/") && pathname.endsWith("/editar")) return "Editar Permiso";
  if (pathname.startsWith("/permisos/")) return "Detalle de Permiso";
  if (pathname === "/permisos") return "Gestión de Permisos";
  if (pathname === "/titulos/nuevo") return "Nuevo Título de Propiedad";
  if (pathname.startsWith("/titulos/") && pathname.endsWith("/editar")) return "Editar Título";
  if (pathname.startsWith("/titulos/")) return "Detalle de Expediente";
  if (pathname === "/titulos") return "Títulos de Propiedad";
  if (pathname === "/cesiones/nueva") return "Nueva Cesión de Derechos";
  if (pathname === "/cesiones") return "Cesión de Derechos";
  if (pathname === "/no-reclamados/nuevo") return "Nuevo Registro — No Reclamado";
  if (pathname === "/no-reclamados/reconocidos") return "Identificadas";
  if (pathname === "/no-reclamados/lotes-disponibles") return "Lotes disponibles";
  if (pathname === "/no-reclamados/reporte") return "Reporte de Personas No Reclamadas";
  if (pathname.startsWith("/no-reclamados/") && pathname.endsWith("/editar")) return "Editar Registro";
  if (pathname.endsWith("/reconocer")) return "Reconocer persona";
  if (pathname.startsWith("/no-reclamados/")) return "Persona No Reclamada";
  if (pathname === "/no-reclamados") return "Personas No Reclamadas";
  if (pathname === "/incidencias/nueva") return "Reportar incidencia";
  if (pathname.startsWith("/incidencias/") && pathname.endsWith("/editar")) return "Editar incidencia";
  if (pathname === "/incidencias") return "Incidencias en panteones";
  if (pathname === "/reportes") return "Reportes";
  if (pathname === "/bitacora") return "Bitácora";
  if (pathname === "/usuarios/nuevo") return "Nuevo usuario";
  if (pathname.startsWith("/usuarios/") && pathname.endsWith("/editar")) return "Editar usuario";
  if (pathname === "/usuarios") return "Usuarios";
  if (pathname === "/reimpresiones") return "Reimpresiones";
  return "Panteones Municipales";
}

export function Layout() {
  const { usuario, logout } = useAuth();
  const location = useLocation();
  const [oscuro, setOscuro] = useState(() => document.documentElement.classList.contains("dark"));
  const enNoReclamados = location.pathname.startsWith("/no-reclamados");
  const [grupoAbierto, setGrupoAbierto] = useState(() => localStorage.getItem("nav:grupoNR") === "true");

  useEffect(() => {
    if (enNoReclamados) setGrupoAbierto(true);
  }, [enNoReclamados]);

  const tituloPagina = tituloDePagina(location.pathname);
  useEffect(() => {
    document.title = `${tituloPagina} — Panteones Nogales`;
  }, [tituloPagina]);

  function alternarGrupo() {
    setGrupoAbierto((v) => {
      localStorage.setItem("nav:grupoNR", String(!v));
      return !v;
    });
  }

  function alternarOscuro() {
    const activo = document.documentElement.classList.toggle("dark");
    localStorage.setItem("darkMode", String(activo));
    setOscuro(activo);
    // Fuerza un recálculo de estilos: algunos motores no repintan de inmediato
    // los `background` que dependen de variables CSS al alternar la clase.
    void document.body.offsetHeight;
  }

  return (
    <div className="shell">
      <aside className="shell-sidebar">
        <div className="shell-brand">
          <img src={logoNogales} alt="Escudo de Nogales" />
          <div className="shell-brand-texto">
            H. Ayuntamiento de Nogales
            <small>Depto. de Panteones</small>
          </div>
        </div>
        <nav className="shell-nav">
          <NavLink to="/" end className={({ isActive }) => "shell-link" + (isActive ? " activo" : "")}>
            <i className="bi bi-speedometer2 shell-link-icono" /> Inicio
          </NavLink>

          {GRUPOS.slice(0, 2).map((g) => (
            <div key={g.titulo}>
              <div className="shell-section">{g.titulo}</div>
              {g.enlaces.map((e) => (
                <NavLink
                  key={e.to + e.label}
                  to={e.to}
                  className={({ isActive }) => "shell-link" + (isActive ? " activo" : "") + (e.sub ? " shell-link-sub" : "")}
                >
                  {e.icono && <i className={`bi ${e.icono} shell-link-icono`} />} {e.label}
                </NavLink>
              ))}
            </div>
          ))}

          <div className="shell-section">Fosa común</div>
          <div className={"nav-group" + (enNoReclamados ? " dentro" : "") + (grupoAbierto ? " abierto" : "")}>
            <button type="button" className="nav-group-head" onClick={alternarGrupo}>
              <i className="bi bi-person-x" />
              No Reclamados
              <i className="bi bi-chevron-down nav-chev" />
            </button>
            <div className="nav-children">
              {HIJOS_NO_RECLAMADOS.map((h) => (
                <NavLink key={h.to} to={h.to} end={h.exacto} className={({ isActive }) => "shell-link" + (isActive ? " activo" : "")}>
                  <i className={`bi ${h.icono} shell-link-icono`} /> {h.label}
                </NavLink>
              ))}
            </div>
          </div>

          {GRUPOS.slice(2).map((g) => (
            <div key={g.titulo}>
              <div className="shell-section">{g.titulo}</div>
              {g.enlaces
                .filter((e) => !e.soloAdmin || usuario?.rol === "Administrador")
                .map((e) => (
                  <NavLink key={e.to} to={e.to} className={({ isActive }) => "shell-link" + (isActive ? " activo" : "")}>
                    <i className={`bi ${e.icono} shell-link-icono`} /> {e.label}
                  </NavLink>
                ))}
            </div>
          ))}
        </nav>
        <div className="shell-footer">Panteones v1.0 · Nogales, Son. 2026</div>
      </aside>
      <div className="shell-main">
        <header className="shell-topbar">
          <span style={{ color: "rgba(255,255,255,.94)", fontWeight: 600, fontSize: "0.9rem", display: "flex", alignItems: "center", gap: 8 }}>
            <i className="bi bi-geo-alt" style={{ color: "var(--dorado-suave)" }} />
            {tituloPagina}
          </span>
          <div className="shell-usuario">
            <button className="shell-topbar-btn" onClick={alternarOscuro} title="Cambiar tema">
              <i className={`bi ${oscuro ? "bi-sun" : "bi-moon-stars"}`} />
            </button>
            <div className="shell-divider" />
            <div className="shell-avatar">{iniciales(usuario?.nombreCompleto)}</div>
            <span className="shell-usuario-nombre">{usuario?.nombreCompleto}</span>
            <button className="shell-topbar-btn" onClick={() => logout()} title="Cerrar sesión">
              <i className="bi bi-box-arrow-right" />
            </button>
          </div>
        </header>
        <main className="shell-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
