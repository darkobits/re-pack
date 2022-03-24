import chex from '@darkobits/chex';
import packlist from 'npm-packlist';

import log from 'lib/log';
import {
  getPkgInfo,
  temporarilyRemoveProblematicPackageScripts
} from 'lib/utils';


/**
 * @private
 *
 * Execa instance bound to NPM.
 */
const npm = chex.sync('npm >=6.0.0');


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

  log.info(log.prefix('link'), `${log.chalk.bold('Linking package:')} ${log.chalk.green(pkgInfo.json.name)}`);

  const restorePackageJson = await temporarilyRemoveProblematicPackageScripts(pkgInfo);

  await npm(['link', '--ignore-scripts'], {
    cwd,
    stdio: 'inherit'
  });

  await restorePackageJson();

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
  dryRun?: boolean | undefined;
  tag?: string | undefined;
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
  const pkgInfo = await getPkgInfo(cwd);

  const args = ['publish', '--ignore-scripts'];

  if (dryRun) {
    args.push('--dry-run');
  }

  if (tag) {
    args.push(`--tag=${tag}`);
  }

  log.verbose(log.prefix('publishPackage'), `Running ${log.chalk.bold(`\`npm ${args.join(' ')}\``)}.`);

  const restorePackageJson = await temporarilyRemoveProblematicPackageScripts(pkgInfo);

  await npm(args, { cwd, stdio: 'inherit' });

  await restorePackageJson();
}
