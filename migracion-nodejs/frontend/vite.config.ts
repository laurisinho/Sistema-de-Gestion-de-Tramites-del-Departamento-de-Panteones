import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // GitHub Pages sirve un "project site" en /<repo>/ y no en la raíz del
  // dominio; sin esto los <script>/<link> del build apuntarían a rutas
  // inexistentes. El workflow de despliegue fija esta variable; en desarrollo
  // queda en "/".
  base: process.env.VITE_BASE_PATH ?? "/",
})
