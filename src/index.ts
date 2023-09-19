import fs from "node:fs";
import path from "node:path";
import {
  type Plugin,
  loadConfigFromFile,
  searchForWorkspaceRoot,
  ConfigEnv,
} from "vite";

async function collectMeta(env: ConfigEnv) {
  const { glob } = await import("glob");
  const workspaceRoot = searchForWorkspaceRoot(process.cwd());

  const configFiles = await glob("**/vite.config.{js,ts}", {
    cwd: workspaceRoot,
    ignore: "**/node_modules/**",
    absolute: true,
    // debug: true,
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
        Object.entries(entry)
          .filter(([key]) => key !== "index")
          .forEach(([entryKey, file]) => {
            // keySet.add(path.join(pkg.name, entryKey));

            entries[entryKey] = path.resolve(dir, file);
          });

        // place `index` as the last to avoid sub path overrides
        if (entry.index) {
          entries[""] = path.resolve(dir, entry.index);
        }
      }

      mapper[dir] = { pkg, entries };
    }
  }

  return { mapper, keys: [...keySet] };
}

export default function vitePluginWorkspace(): Plugin {
  let env: ConfigEnv;
  let meta: Awaited<ReturnType<typeof collectMeta>>;

  return {
    name: "vite-plugin-workspace",
    config(c, e) {
      env = e;
    },
    resolveId: {
      order: "pre",
      async handler(source, importer) {
        // collect workspace libraries
        if (!meta) meta = await collectMeta(env);

        const name = meta.keys.find((k) => source.startsWith(k));
        if (!name) return;

        // `lodash/get` -> get
        const subpath = source.slice(name.length + 1);

        const { findUp } = await import("find-up");
        const dir = await findUp(path.join("node_modules", source), {
          type: "directory",
          cwd: importer,
        });
        if (!dir) return;

        const realDir = await fs.promises.realpath(dir);
        const selected = meta.mapper[realDir];
        if (!selected) return;

        const entry = selected.entries[subpath];
        if (!entry) return;

        console.log("[resolved]", source, entry);

        return entry;
      },
    },
  };
}
