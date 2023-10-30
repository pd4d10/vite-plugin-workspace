import fs from "node:fs";
import path from "node:path";
import micromatch from "micromatch";
import { ConfigEnv, loadConfigFromFile, searchForWorkspaceRoot } from "vite";
import glob from "fast-glob";
import { resolveModule } from "local-pkg";
import { Meta, Project } from "./types.js";

export async function createInquirer() {
  const { default: inquirer } = await import("inquirer");
  // @ts-ignore
  const { default: searchList } = await import("inquirer-search-list");
  inquirer.registerPrompt("search-list", searchList);
  return inquirer;
}

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

export function createSelectorExample(cmd: string, multiple = false) {
  if (multiple)
    return `
  $ vite-workspace ${cmd} @babel/core             # exact package name
  $ vite-workspace ${cmd} @babel/core @babel/cli  # multiple package names
  $ vite-workspace ${cmd} "@babel/*"              # package name glob pattern
  $ vite-workspace ${cmd} "./packages/core"       # path starts with ./
  $ vite-workspace ${cmd} "./packages/*"          # path glob pattern`.slice(1);

  return `
  $ vite-workspace ${cmd} @babel/core        # package name
  $ vite-workspace ${cmd} ./packages/core    # path starts with ./`.slice(1);
}

export async function createFinalConfig(project: Project) {
  const wsRoot = searchForWorkspaceRoot(process.cwd());
  const dir = path.resolve(wsRoot, "node_modules/.vite-workspace");
  try {
    await fs.promises.mkdir(dir, { recursive: true });
  } catch {}

  const p = path.resolve(
    dir,
    project.packageJson.name.replaceAll("/", "_") + ".mjs"
  );
  await fs.promises.writeFile(
    p,
    `
import config from ${JSON.stringify(project.viteConfig.path)}
import { mergeConfig } from "vite"
import { vitePlugin } from "vite-workspace"

export default mergeConfig(config, {
  root: ${JSON.stringify(project.root)},
  plugins: [vitePlugin()],
})
`
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
  const projects: Project[] = [];

  for (const configFile of configFiles) {
    const dir = path.dirname(configFile);

    const conf = await loadConfigFromFile(env, configFile);
    if (!conf) continue;

    const pkg = JSON.parse(
      await fs.promises.readFile(path.resolve(dir, "package.json"), "utf-8")
    );

    projects.push({
      root: dir,
      packageJson: pkg,
      viteConfig: conf,
    });

    if (conf.config.build?.lib) {
      keySet.add(pkg.name);

      const entries: Record<string, string> = {};
      const { entry } = conf.config.build.lib;

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

  return { mapper, keys: [...keySet], projects };
}
