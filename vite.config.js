import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { createRoom } from "./server/room.js";

function roomPlugin() {
  const room = createRoom();
  const attach = (server) => {
    server.middlewares.use(room.handle);
  };
  return {
    name: "monopoly-room",
    configureServer: attach,
    configurePreviewServer: attach,
  };
}

export default defineConfig({
  plugins: [roomPlugin(), react(), tailwindcss()],
  server: { host: true },
  preview: { host: true },
});
