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
