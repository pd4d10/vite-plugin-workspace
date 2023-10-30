import path from "node:path";
import { fileURLToPath } from "node:url";
import { cac } from "cac";
import {
  collectMeta,
  createInquirer,
  createSelectorExample,
  resolveBinPath,
  createFinalConfig,
  selectProjects,
} from "./utils.js";
import fs from "node:fs";
import { Meta, Project } from "./types.js";
import { execaCommand } from "execa";

function getArgsOffect(selector: string | string[] = []) {
  if (typeof selector === "string") selector = [selector];
  return selector.length + 3;
}

export async function main() {
  const { version } = JSON.parse(
    await fs.promises.readFile(
      path.resolve(fileURLToPath(import.meta.url), "../.."),
      "utf-8"
    )
  );

  const cli = cac("vite-workspace").version(version).help();

  cli
    .command("", "select project to dev")
    .allowUnknownOptions()
    .action(async () => {
      const meta = await collectMeta({
        command: "serve",
        mode: "development",
      });
      const inquirer = await createInquirer();
      const project = await inquirer
        .prompt<{ value: Project }>({
          // @ts-ignore
          type: "search-list",
          name: "value",
          message: "Please select the project",
          choices: meta.projects
            .filter((p) => {
              return (
                p.packageJson.scripts.dev || // explicitly specified
                !p.viteConfig?.config.build?.lib // not a lib
              );
            })
            .map((p) => {
              return {
                name: p.packageJson.name,
                value: p,
              };
            }),
        })
        .then((p) => p.value);

      const cmd = project.packageJson.scripts.dev
        ? "npm run dev"
        : `npx vite --config ${await createFinalConfig(project)}`;

      await execaCommand(cmd, { cwd: project.root });
    });

  cli
    .command("serve [project]", "start dev server")
    .alias("dev")
    .example(createSelectorExample("dev"))
    .allowUnknownOptions()
    .action(async (selector: string | undefined) => {
      const meta = await collectMeta({
        command: "serve",
        mode: "development",
      });

      // const selectProjects([selector], meta.projects)[0];
      // const rawArgs = cli.rawArgs.slice(getArgsOffect(selector));
      // await selectAndRun(selector, meta, "serve", rawArgs);
    });

  cli
    .command("build [...projects]", "build projects")
    .example(createSelectorExample("build", true))
    .allowUnknownOptions()
    .action(async (selectors: string[]) => {
      if (!selectors.length) {
        cli.outputHelp();
        return;
      }

      const meta = await collectMeta({
        command: "build",
        mode: "production",
      });

      await build(
        projects,
        workspaceDir,
        selectors,
        cli.rawArgs.slice(getArgsOffect(selectors))
      );
    });

  cli
    .command("preview [project]", "preview production build")
    .example(createSelectorExample("preview"))
    .allowUnknownOptions()
    .action(async (selector: string | undefined) => {
      const rawArgs = cli.rawArgs.slice(getArgsOffect(selector));
      await selectAndRun(selector, meta, "serve", rawArgs);
    });

  cli.parse();
}
