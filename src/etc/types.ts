export interface RePackOptions {
  /**
   * Directory containing the package to re-pack.
   *
   * Default: process.cwd()
   */
  cwd?: string;

  /**
   * Sub-directory in the host package containing build artifacts to be hoisted
   * to the package root. Usually 'dist'.
   */
  buildDir: string;

  /**
   * (Optional) Directory where re-pack will stage files to be published. By
   * default, a temporary directory is used.
   */
  workspaceDir?: string;

  /**
   * (Optional) Mapping of symlink names -> canonical file locations in the
   * publish workspace. This will allow the user to further customize their
   * import paths.
   */
  // entries?: Array<{
  //   from: string;
  //   to: string;
  // }>;
}


export interface RePackCliOptions {
  distDir: string;
  publish?: boolean;
  outDir?: string;
}


// export interface RePackConfiguration extends RePackCliOptions {
//   entries: RePackOptions['entries'];
// }
