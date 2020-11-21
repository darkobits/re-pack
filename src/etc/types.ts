export interface RePackOptions {
  /**
   * Directory containing the package to re-pack.
   *
   * Default: process.cwd()
   */
  cwd?: string;

  /**
   * Sub-directory in the host package (typically containing build artifacts) to
   * be hoisted to the package root.
   *
   * Default: 'dist'
   */
  srcDir?: string;

  /**
   * (Optional) Directory where re-pack will stage files to be published. By
   * default, a temporary directory is used.
   *
   * Default: .re-pack
   */
  packDir?: string;

  /**
   * If true, continuously watches `srcDir` and re-packs to `outDir`.
   *
   * Default: false
   */
  watch?: boolean;

  /**
   * If true, runs `npm link` from within the re-pack directory.
   *
   * Default: false
   */
  link?: boolean;

  /**
   * If true, runs `npm publish` after re-packing.
   *
   * Default: false
   */
  publish?: boolean;
}


// export interface RePackCliOptions {
//   cwd: string;
//   srcDir: string;
//   packDir: string;
//   publish: boolean;
//   watch: string;
// }


// export interface RePackConfiguration extends RePackCliOptions {
//   entries: RePackOptions['entries'];
// }
