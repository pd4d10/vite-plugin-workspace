import { PluginOption } from "vite";
import tsconfig from "vite-tsconfig-paths";
import { resolve } from "./resolve.js";
import lib from "./lib.js";

export function vitePlugin(): PluginOption {
  return [resolve(), tsconfig(), lib()];
}
