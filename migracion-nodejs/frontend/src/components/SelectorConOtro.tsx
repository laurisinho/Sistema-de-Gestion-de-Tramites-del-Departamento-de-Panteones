import { useEffect, useState } from "react";

const OTRO = "__otro__";

interface Props {
  value: string;
  onChange: (valor: string) => void;
  opciones: string[] | undefined;
  placeholderOtro?: string;
}

// <select> con las opciones dadas de alta en Administración, más "Otro" para
// cuando no está en la lista: evita errores de captura y duplicados en los
// nombres más comunes sin bloquear uno nuevo. Si el valor que ya trae el campo
// (p. ej. al editar un registro viejo) no está entre las opciones, arranca en
// modo "Otro" para no perderlo.
export function SelectorConOtro({ value, onChange, opciones, placeholderOtro = "Especifica..." }: Props) {
  const [modoOtro, setModoOtro] = useState(false);

  useEffect(() => {
    if (value && opciones && !opciones.includes(value)) setModoOtro(true);
  }, [value, opciones]);

  if (modoOtro) {
    return (
      <div style={{ display: "flex", gap: 6 }}>
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholderOtro} style={{ flex: 1 }} />
        {!!opciones?.length && (
          <button
            type="button"
            className="boton-secundario boton-sm"
            title="Elegir de la lista"
            onClick={() => {
              setModoOtro(false);
              onChange("");
            }}
          >
            <i className="bi bi-list" />
          </button>
        )}
      </div>
    );
  }

  return (
    <select
      value={value}
      onChange={(e) => {
        if (e.target.value === OTRO) {
          setModoOtro(true);
          onChange("");
        } else {
          onChange(e.target.value);
        }
      }}
    >
      <option value="">Selecciona...</option>
      {opciones?.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
      <option value={OTRO}>Otro (especificar)...</option>
    </select>
  );
}
