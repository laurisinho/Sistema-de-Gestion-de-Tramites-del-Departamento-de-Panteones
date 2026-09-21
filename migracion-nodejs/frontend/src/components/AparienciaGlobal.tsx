import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { aplicarApariencia } from "../lib/colores";

interface Apariencia {
  colorGuinda: string;
  colorDorado: string;
}

// Sin UI propia: aplica los colores vigentes (o los predeterminados, si nadie los
// ha cambiado) al cargar. Va fuera de <ProtectedRoute> porque el login también
// necesita el color correcto.
export function AparienciaGlobal() {
  const { data } = useQuery({
    queryKey: ["apariencia"],
    queryFn: () => api<Apariencia>("/apariencia"),
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (data) aplicarApariencia(data.colorGuinda, data.colorDorado);
  }, [data]);

  return null;
}
