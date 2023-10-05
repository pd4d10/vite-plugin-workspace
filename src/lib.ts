import fs from "node:fs";
import path from "node:path";
import { Plugin, UserConfig, mergeConfig } from "vite";

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

        return mergeConfig<UserConfig, UserConfig>(c, {
          build: {
            rollupOptions: {
              external: [
                ...externalDeps,
                ...externalDeps.map((dep) => new RegExp(`^${dep}\/`)),
              ],
            },
          },
        });
      }
    },
  };
}
