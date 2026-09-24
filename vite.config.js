import { defineConfig } from "vite";
import { sveltekit } from "@sveltejs/kit/vite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const pkg = JSON.parse(readFileSync("./package.json", "utf-8"));
const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
    base: "./",
    plugins: [sveltekit()],
    define: {
        __APP_VERSION__: JSON.stringify(pkg.version),
    },
    clearScreen: false,
    server: {
        port: 1420,
        strictPort: true,
        host: host || false,
        hmr: host
            ? {
                protocol: "ws",
                host,
                port: 1421,
            }
            : undefined,
        watch: {
            ignored: ["**/src-tauri/**"],
        },
    },
    resolve: {
        alias: {
            "@static": new URL("./static", import.meta.url).pathname,
        },
    },
    build: {
        outDir: "build",
        emptyOutDir: true,
    },
}));