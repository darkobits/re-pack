import { RePackArguments, PublishArguments } from 'etc/types'

/**
 * Fields in package.json that may contain paths that will need to be re-written
 * when packing.
 */
export const REWRITE_FIELDS = [
  'bin',
  'browser',
  'directories',
  'exports',
  'files',
  'main',
  'man',
  'module'
]

export const DEFAULT_OPTIONS: RePackArguments = {
  cwd: process.cwd(),
  hoistDir: 'dist',
  packDir: '.re-pack',
  watch: false,
  link: false
}

export const DEFAULT_PUBLISH_OPTIONS: PublishArguments = {
  cwd: DEFAULT_OPTIONS.cwd,
  hoistDir: DEFAULT_OPTIONS.hoistDir,
  packDir: DEFAULT_OPTIONS.packDir,
  dryRun: false
}