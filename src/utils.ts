import fs from "node:fs";
import path from "node:path";
import micromatch from "micromatch";
import { ConfigEnv, loadConfigFromFile, searchForWorkspaceRoot } from "vite";
import glob from "fast-glob";
import { Project } from "./types.js";

export function selectProjects(selectors: string[], projects: Project[]) {
  selectors = selectors.map((s) =>
    s.replace(/^('|")/, "").replace(/('|")$/, "")
  );
  const pathMatches = micromatch(
    projects.map((p) => p.root),
    selectors.filter((s) => s.startsWith("./"))
  );
  const nameMatches = micromatch(
    projects.map((p) => p.packageJson.name),
    selectors.filter((s) => !s.startsWith("./"))
  );

  return projects.filter(
    (p) =>
      pathMatches.includes(p.root) || nameMatches.includes(p.packageJson.name)
  );
}

export async function collectMeta(env: ConfigEnv) {
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

      // default css output, alias to the main path
      if (entries[""]) {
        entries["dist/style.css"] = entries[""];
      }

      mapper[dir] = { pkg, entries };
    }
  }

  return { mapper, keys: [...keySet] };
}
