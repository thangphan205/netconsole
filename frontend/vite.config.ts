import { TanStackRouterVite } from "@tanstack/router-vite-plugin"
import react from "@vitejs/plugin-react-swc"
import { defineConfig } from "vite"
import { version } from "./package.json"

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), TanStackRouterVite()],
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
})
