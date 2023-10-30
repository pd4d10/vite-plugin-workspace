import { loadConfigFromFile } from "vite";

export interface Project {
  root: string;
  packageJson: {
    name: string;
    scripts: Record<string, string>;
  };
  viteConfig: NonNullable<Awaited<ReturnType<typeof loadConfigFromFile>>>;
}

export interface Meta {
  workspaceRoot: string;
  projects: Project[];
}
