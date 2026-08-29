import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { LotesBuscar } from "./pages/Lotes/Buscar";
import { LoteExpediente } from "./pages/Lotes/Expediente";
import { PermisosLista } from "./pages/Permisos/Lista";
import { PermisoNuevo } from "./pages/Permisos/Nuevo";
import { PermisoEditar } from "./pages/Permisos/Editar";
import { PermisoDetalle } from "./pages/Permisos/Detalle";
import { TitulosLista } from "./pages/Titulos/Lista";
import { TituloNuevo } from "./pages/Titulos/Nuevo";
import { TituloEditar } from "./pages/Titulos/Editar";
import { TituloDetalle } from "./pages/Titulos/Detalle";
import { CesionesLista } from "./pages/Cesiones/Lista";
import { CesionNueva } from "./pages/Cesiones/Nueva";
import { NoReclamadosLista } from "./pages/NoReclamados/Lista";
import { NoReclamadoDetalle } from "./pages/NoReclamados/Detalle";
import { NoReclamadoReconocer } from "./pages/NoReclamados/Reconocer";
import { NoReclamadoCrear } from "./pages/NoReclamados/Crear";
import { NoReclamadoEditar } from "./pages/NoReclamados/Editar";
import { NoReclamadosReconocidos } from "./pages/NoReclamados/Reconocidos";
import { NoReclamadosLotesDisponibles } from "./pages/NoReclamados/LotesDisponibles";
import { NoReclamadosReporte } from "./pages/NoReclamados/Reporte";
import { IncidenciasLista } from "./pages/Incidencias/Lista";
import { IncidenciaNueva } from "./pages/Incidencias/Nueva";
import { IncidenciaEditar } from "./pages/Incidencias/Editar";
import { ReportesIndex } from "./pages/Reportes/Index";
import { BitacoraLista } from "./pages/Bitacora/Lista";
import { ReimpresionesLista } from "./pages/Reimpresiones/Lista";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Dashboard />} />
            <Route path="/lotes" element={<LotesBuscar />} />
            <Route path="/lotes/:id/expediente" element={<LoteExpediente />} />
            <Route path="/permisos" element={<PermisosLista />} />
            <Route path="/permisos/nuevo" element={<PermisoNuevo />} />
            <Route path="/permisos/:id/editar" element={<PermisoEditar />} />
            <Route path="/permisos/:id" element={<PermisoDetalle />} />
            <Route path="/titulos" element={<TitulosLista />} />
            <Route path="/titulos/nuevo" element={<TituloNuevo />} />
            <Route path="/titulos/:id/editar" element={<TituloEditar />} />
            <Route path="/titulos/:id" element={<TituloDetalle />} />
            <Route path="/cesiones" element={<CesionesLista />} />
            <Route path="/cesiones/nueva" element={<CesionNueva />} />
            <Route path="/no-reclamados" element={<NoReclamadosLista />} />
            <Route path="/no-reclamados/nuevo" element={<NoReclamadoCrear />} />
            <Route path="/no-reclamados/reconocidos" element={<NoReclamadosReconocidos />} />
            <Route path="/no-reclamados/lotes-disponibles" element={<NoReclamadosLotesDisponibles />} />
            <Route path="/no-reclamados/reporte" element={<NoReclamadosReporte />} />
            <Route path="/no-reclamados/:id" element={<NoReclamadoDetalle />} />
            <Route path="/no-reclamados/:id/editar" element={<NoReclamadoEditar />} />
            <Route path="/no-reclamados/:id/reconocer" element={<NoReclamadoReconocer />} />
            <Route path="/incidencias" element={<IncidenciasLista />} />
            <Route path="/incidencias/nueva" element={<IncidenciaNueva />} />
            <Route path="/incidencias/:id/editar" element={<IncidenciaEditar />} />
            <Route path="/reportes" element={<ReportesIndex />} />
            <Route path="/bitacora" element={<BitacoraLista />} />
            <Route path="/reimpresiones" element={<ReimpresionesLista />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
