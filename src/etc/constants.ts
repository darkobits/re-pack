import { RePackArguments, PublishArguments } from 'etc/types';

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
];


export const DEFAULT_OPTIONS: RePackArguments = {
  hoistDir: 'dist',
  packDir: '.re-pack',
  watch: false,
  link: false
};


export const DEFAULT_PUBLISH_OPTIONS: PublishArguments = {
  hoistDir: 'dist',
  packDir: '.re-pack',
  dryRun: false
};
