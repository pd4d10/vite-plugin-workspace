import fs from "node:fs";
import path from "node:path";
import { Plugin } from "vite";
import _debug from "debug";

const debug = _debug("vite-workspace:lib");

export default function lib(): Plugin {
  return {
    name: "vite-workspace:lib",
    async config(c) {
      if (c.build?.lib) {
        const pkgJson = await fs.promises.readFile(
          path.resolve(c.root ?? process.cwd(), "package.json"),
          "utf-8"
        );
        const pkg = JSON.parse(pkgJson);

        const externalDeps = Object.keys({
          ...pkg.dependencies,
          ...pkg.peerDependencies,
        });

        debug(`${pkg.name} deps: ${externalDeps}`);

        return {
          build: {
            rollupOptions: {
              external: [
                ...externalDeps,
                ...externalDeps.map((dep) => new RegExp(`^${dep}\/`)),
              ],
            },
          },
        };
      }
    },
  };
}
