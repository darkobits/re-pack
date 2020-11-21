import { RePackOptions } from 'etc/types';

/**
 * Fields in package.json that may contain paths that will need to be re-written
 * when packing.
 */
export const REWRITE_FIELDS = [
  'bin',
  'directories',
  'main',
  'browser',
  'module',
  'man',
  'files'
];


export const DEFAULT_OPTIONS: Required<RePackOptions> = {
  cwd: process.cwd(),
  srcDir: 'dist',
  packDir: '.re-pack',
  publish: false,
  watch: false,
  link: false,
  dryRun: false
};
