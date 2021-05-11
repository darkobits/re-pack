import path from 'path';

import chex from '@darkobits/chex';
import fs from 'fs-extra';
import packlist from 'npm-packlist';
import * as R from 'ramda';
import readPkgUp, { NormalizedPackageJson } from 'read-pkg-up';

import log from 'lib/log';


/**
 * @private
 *
 * Execa instance bound to NPM.
 */
const npm = chex.sync('npm >=6.0.0');


// ----- Meta ------------------------------------------------------------------

export interface PkgInfo {
  /**
   * Normalized package.json for the resolved package.
   */
  json: NormalizedPackageJson;

  /**
   * Root directory for the resolved package.
   */
  rootDir: string;
}

/**
 * Reads the package.json for the host package by walking up the directory tree
 * from the current working directory. An optional `cwd` param may be provided
 * to override the default.
 */
export async function getPkgInfo(cwd: string = process.cwd()): Promise<PkgInfo> {
  const pkgInfo = await readPkgUp({ cwd });

  if (!pkgInfo) {
    throw new Error(`${log.prefix('getPkgInfo')} Unable to locate package root from: ${log.chalk.green(cwd)}`);
  }

  const rootDir = path.dirname(pkgInfo.path);
  const json = pkgInfo.packageJson;

  return { json, rootDir };
}


// ----- Pack ------------------------------------------------------------------

/**
 * Returns a list of files that should be packed by `npm pack`.
 */
export async function getPackList(cwd: string) {
  return packlist({ path: cwd });
}


// ----- Link ------------------------------------------------------------------

/**
 * Runs `npm link` from the provided directory.Because NPM 7+ no longer honors
 * --ignore-scripts when linking packages, this function will temporarily remove
 * the "prepare" script, link the package, and then re-add it. This is janky,
 * but necessary.
 */
export async function linkPackage(cwd: string) {
  const pkgInfo = await getPkgInfo(cwd);
  const pkgJsonPath = path.join(pkgInfo.rootDir, 'package.json');

  log.info(log.prefix('link'), `${log.chalk.bold('Linking package:')} ${log.chalk.green(pkgInfo.json.name)}`);

  const prepareScript = R.path(['scripts', 'prepare'], pkgInfo.json);
  log.warn(log.prefix('link'), `Blocking invocation of prepare script: ${log.chalk.green(`"${prepareScript}"`)}`);
  const pkgJsonWithoutPrepareScript = R.dissocPath(['scripts', 'prepare'], pkgInfo.json);
  await fs.writeJSON(pkgJsonPath, pkgJsonWithoutPrepareScript, { spaces: 2 });

  await npm(['link', '--ignore-scripts'], {
    cwd,
    stdio: 'inherit'
  });

  await fs.writeJSON(pkgJsonPath, pkgInfo.json, { spaces: 2 });

  log.info(log.prefix('link'), log.chalk.bold('Done.'));
}


// ----- Lifecycles ------------------------------------------------------------

export interface RunLifecycleScriptOptions {
  cwd: string;
  scriptName: string;
}

/**
 * Runs the indicated NPM lifecycle script from the indicated directory.
 */
export async function runLifecycleScript(opts: RunLifecycleScriptOptions) {
  const args = ['run', opts.scriptName];

  log.verbose(log.prefix(opts.scriptName), `Running ${log.chalk.bold(`\`npm ${args.join(' ')}\``)}.`);

  await npm(args, {
    cwd: opts.cwd,
    stdio: 'inherit',
    env: {
      FORCE_COLOR: '3'
    }
  });
}


// ----- Publish ---------------------------------------------------------------

export interface PublishOptions {
  cwd: string;
  dryRun?: boolean;
  tag?: string;
}

/**
 * Publishes the NPM package from the directory indicated by `cwd`. Optional
 * `dryRun` and `tag` options may be provided as well.
 *
 * This command is always run with the --ignore-scripts flag as it is run from
 * the re-pack workspace, and re-pack explicitly runs lifecycle scripts from the
 * package root.
 */
export async function publishPackage({ cwd, tag, dryRun }: PublishOptions) {
  const args = ['publish', '--ignore-scripts'];

  if (dryRun) {
    args.push('--dry-run');
  }

  if (tag) {
    args.push(`--tag=${tag}`);
  }

  log.verbose(log.prefix('publishPackage'), `Running ${log.chalk.bold(`\`npm ${args.join(' ')}\``)}.`);

  await npm(args, { cwd, stdio: 'inherit' });
}
