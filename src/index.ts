import { PluginOption } from "vite";
import { resolve } from "./resolve.js";
import tsconfig from "vite-tsconfig-paths";

export function vitePlugin(): PluginOption {
  return [resolve(), tsconfig()];
}
