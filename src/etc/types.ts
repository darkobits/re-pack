/**
 * Arguments/options for the root command.
 */
export interface RePackArguments {
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
  hoistDir?: string;

  /**
   * (Optional) Directory where re-pack will stage files to be published.
   *
   * Default: .re-pack
   */
  packDir?: string;

  /**
   * If true, continuously watches `hoistDir` and re-packs to `outDir`.
   *
   * Default: false
   */
  watch?: boolean;

  /**
   * If true, runs `npm link` after re-packing.
   *
   * Default: false
   */
  link?: boolean;


}


/**
 * Arguments/options for the `publish` sub-command.
 */
export interface PublishArguments {
  /**
   * Directory containing the package to re-pack and publish.
   *
   * Default: process.cwd()
   */
  cwd?: string;

  /**
   * Sub-directory in the host package (typically containing build artifacts) to
   * be hoisted to the root of the re-pack directory.
   *
   * Default: 'dist'
   */
  hoistDir?: string;

  /**
   * (Optional) Directory where re-pack will stage files to be published.
   *
   * Default: .re-pack
   */
  packDir?: string;

  /**
   * Passes the --dry-run flag to `npm publish`.
   *
   * Default: false
   */
  dryRun?: boolean;

  /**
   * Optional access to set on the published package. Forwards to the --access
   * argument of `npm publish`.
   *
   * Default: N/A
   */
  access?: string;

  /**
   * Optional dist-tag to publish the package under. Forwards to the --tag
   * argument of `npm publish`.
   *
   * Default: N/A
   */
  tag?: string;
}
