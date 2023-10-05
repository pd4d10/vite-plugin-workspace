import fs from "node:fs";
import path from "node:path";
import { ConfigEnv, loadConfigFromFile, searchForWorkspaceRoot } from "vite";

export async function collectMeta(env: ConfigEnv) {
  const { glob } = await import("fast-glob");
  const workspaceRoot = searchForWorkspaceRoot(process.cwd());

  const configFiles = await glob("**/vite.config.{js,ts}", {
    cwd: workspaceRoot,
    ignore: ["**/node_modules/**"],
    absolute: true,
  });

  const mapper: Record<
    string,
    { pkg: { name: string }; entries: Record<string, string> }
  > = {};
  const keySet = new Set<string>();

  for (const configFile of configFiles) {
    const dir = path.dirname(configFile);

    const r = await loadConfigFromFile(env, configFile);
    if (!r) continue;

    const pkg = JSON.parse(
      await fs.promises.readFile(path.resolve(dir, "package.json"), "utf-8")
    );

    if (r.config.build?.lib) {
      keySet.add(pkg.name);

      const entries: Record<string, string> = {};
      const { entry } = r.config.build.lib;

      if (typeof entry === "string") {
        entries[""] = path.resolve(dir, entry);
      } else if (Array.isArray(entry)) {
        // TODO:
      } else {
        Object.entries(entry).forEach(([entryKey, file]) => {
          entries[entryKey] = path.resolve(dir, file);
        });
      }

      // default css output, alias to the main path
      if (entries[""]) {
        entries["dist/style.css"] = entries[""];
      }

      mapper[dir] = { pkg, entries };
    }
  }

  return { mapper, keys: [...keySet] };
}
