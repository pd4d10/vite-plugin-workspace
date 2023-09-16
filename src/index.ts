import fs from "node:fs";
import path from "node:path";
import {
  type Plugin,
  mergeConfig,
  resolveConfig,
  searchForWorkspaceRoot,
  type UserConfig,
  type AliasOptions,
} from "vite";

export default function vitePluginWorkspace(): Plugin {
  return {
    name: "vite-plugin-workspace",
    async config(c) {
      const workspaceRoot = searchForWorkspaceRoot(process.cwd());
      const { glob } = await import("glob");

      const configFiles = await glob("**/vite.config.{js,ts}", {
        cwd: workspaceRoot,
        ignore: "**/node_modules/**",
        absolute: true,
      });

      const alias: AliasOptions = {};
      for (const configFile of configFiles) {
        const dir = path.dirname(configFile);

        const config = await resolveConfig({ configFile }, "build"); // TODO:
        const pkg = JSON.parse(
          await fs.promises.readFile(path.resolve(dir, "package.json"), "utf-8")
        );

        if (config.build.lib && typeof config.build.lib.entry === "string") {
          // TODO: multiple entries
          alias[pkg.name] = path.resolve(dir, config.build.lib.entry);
        }
      }

      // console.log(alias);

      const extra: UserConfig = {
        resolve: { alias },
      };
      return mergeConfig(c, extra);
    },
  };
}
