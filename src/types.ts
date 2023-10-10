export interface Project {
  root: string;
  packageJson: {
    name: string;
  };
  configPath: string;
}

export interface Meta {
  workspaceRoot: string;
  projects: Project[];
}
