/// <reference types="vitest/config" />
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import type { Plugin } from "vite";

export default defineConfig(() => {
  const isTest = !!process.env.VITEST;
  const plugins = [
    !isTest ? cloudflare({ viteEnvironment: { name: "ssr" } }) : null,
    tailwindcss(),
    tsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    !isTest ? tanstackStart() : null,
    viteReact(),
  ].filter(Boolean) as Plugin[];

  return {
    server: {
      port: 3100,
    },
    plugins,
    test: {
      environment: "node",
      include: ["src/**/*.{test,spec}.{ts,tsx}"],
    },
  };
});
