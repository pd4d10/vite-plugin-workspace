import fs from "node:fs";
import path from "node:path";
import {
  type Plugin,
  mergeConfig,
  loadConfigFromFile,
  searchForWorkspaceRoot,
  type UserConfig,
  type AliasOptions,
} from "vite";

export default function vitePluginWorkspace(): Plugin {
  return {
    name: "vite-plugin-workspace",
    async config(c, env) {
      const workspaceRoot = searchForWorkspaceRoot(process.cwd());
      const { glob } = await import("glob");

      const configFiles = await glob("**/vite.config.{js,ts}", {
        cwd: workspaceRoot,
        ignore: "**/node_modules/**",
        absolute: true,
        // debug: true,
      });

      const alias: AliasOptions = {};
      for (const configFile of configFiles) {
        const dir = path.dirname(configFile);

        const r = await loadConfigFromFile(env, configFile);
        if (!r) continue;

        const pkg = JSON.parse(
          await fs.promises.readFile(path.resolve(dir, "package.json"), "utf-8")
        );

        if (
          r.config.build?.lib &&
          typeof r.config.build.lib.entry === "string"
        ) {
          // TODO: multiple entries
          alias[pkg.name] = path.resolve(dir, r.config.build.lib.entry);
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
