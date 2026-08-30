const CLAVE = "auth_token";

// Cookies entre sitios distintos (github.io -> onrender.com) las bloquean
// varios navegadores por privacidad (Brave, Safari, y cada vez más Chrome),
// sin importar cómo se configure SameSite/Secure. El token viaja explícito
// en el header Authorization en su lugar; localStorage solo lo persiste
// entre recargas de esta misma pestaña/navegador.
export function getToken(): string | null {
  try {
    return localStorage.getItem(CLAVE);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  try {
    localStorage.setItem(CLAVE, token);
  } catch {
    // Sin localStorage (modo privado estricto) la sesión no sobrevive un refresh.
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(CLAVE);
  } catch {
    // ver getToken
  }
}
