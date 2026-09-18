import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { aplicarApariencia } from "../lib/colores";

interface Apariencia {
  colorGuinda: string;
  colorDorado: string;
}

// Sin UI propia: aplica los colores vigentes (o los de siempre, si nadie los
// ha cambiado) en cuanto cargan. Va fuera de <ProtectedRoute> porque hasta
// el login necesita pintarse con el color correcto.
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
