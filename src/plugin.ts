import fs from "node:fs";
import path from "node:path";
import { type Plugin, ConfigEnv } from "vite";
import _debug from "debug";
import { collectMeta } from "./utils.js";

const debug = _debug("vite-workspace");

export function plugin(): Plugin {
  let env: ConfigEnv;
  let meta: Awaited<ReturnType<typeof collectMeta>>;

  return {
    name: "vite-workspace",
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

        // 'lodash' -> ''
        // 'lodash/get' -> 'get'
        const subpath = source.slice(name.length + 1);

        const { findUp } = await import("find-up");
        const dir = await findUp(path.join("node_modules", name), {
          type: "directory",
          cwd: importer,
        });
        if (!dir) return;

        const realDir = await fs.promises.realpath(dir);
        const selected = meta.mapper[realDir];
        if (!selected) return;

        const entry = selected.entries[subpath];
        if (!entry) return;

        debug(`${source} -> ${entry}`);
        return entry;
      },
    },
  };
}
