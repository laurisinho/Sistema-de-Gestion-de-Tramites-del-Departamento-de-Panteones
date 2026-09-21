const CLAVE = "auth_token";

// Varios navegadores (Brave, Safari y cada vez más Chrome) bloquean por
// privacidad las cookies entre sitios distintos (github.io -> onrender.com), sin
// importar SameSite/Secure. Por eso el token viaja en el header Authorization;
// localStorage solo lo conserva entre recargas.
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
