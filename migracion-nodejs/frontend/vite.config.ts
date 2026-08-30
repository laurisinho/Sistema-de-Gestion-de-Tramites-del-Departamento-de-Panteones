import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // GitHub Pages sirve un "project site" en /<repo>/, no en la raíz del
  // dominio -- sin esto, los <script>/<link> del build apuntarían a rutas
  // absolutas inexistentes. El workflow de despliegue fija esta variable;
  // en desarrollo local no está definida y queda en "/" como siempre.
  base: process.env.VITE_BASE_PATH ?? "/",
})
