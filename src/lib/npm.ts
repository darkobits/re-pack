import chex from '@darkobits/chex';
import log from 'lib/log';


/**
 * @private
 *
 * Execa instance bound to NPM 6.
 */
const npm = chex.sync('npm >=6.0.0');


// ----- Pack ------------------------------------------------------------------

/**
 * Performs a dry run of `npm pack` in the provided root directory and prints
 * the output. Used as a debugging feature to let users introspect what will
 * be published from the publish workspace.
 */
export async function packDryRun(cwd: string) {
  await npm(['pack', '--dry-run', '--ignore-scripts'], {
    cwd,
    stdout: 'ignore',
    stderr: 'inherit',
    env: {
      FORCE_COLOR: '3'
    }
  });
}


// ----- Link ------------------------------------------------------------------


export async function linkPackage(cwd: string) {
  log.info(log.prefix('link'), log.chalk.bold('Linking package.'));

  await npm(['link', '--ignore-scripts'], {
    cwd,
    stdio: 'inherit'
  });

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

  log.info(log.prefix(opts.scriptName), `Running ${log.chalk.bold(`\`npm ${args.join(' ')}\``)}.`);

  await npm(args, {
    cwd: opts.cwd,
    stdio: 'inherit',
    env: {
      FORCE_COLOR: '3'
    }
  });

  console.log('');
  log.info(log.prefix(opts.scriptName), log.chalk.bold('Done.'));
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
export async function publishPackage(opts: PublishOptions) {
  const args = ['publish', '--ignore-scripts'];

  if (opts.dryRun) {
    args.push('--dry-run');
  }

  if (opts.tag) {
    args.push(`--tag=${opts.tag}`);
  }

  log.info(log.prefix('publish'), `Running ${log.chalk.bold(`\`npm ${args.join(' ')}\``)}.`);

  await npm(args, {
    cwd: opts.cwd,
    stdio: 'inherit',
    env: {
      FORCE_COLOR: '3'
    }
  });

  log.info(log.prefix('publish'), log.chalk.bold('Done.'));
}


export default npm;
