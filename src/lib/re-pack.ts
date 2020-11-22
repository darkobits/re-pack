import path from 'path';

import adeiu from '@darkobits/adeiu';
import AsyncLock from 'async-lock';
import chokidar from 'chokidar';
import * as R from 'ramda';

import { DEFAULT_OPTIONS } from 'etc/constants';
import { RePackArguments } from 'etc/types';
import log from 'lib/log';
import {
  getPkgInfo,
  linkPackage
} from 'lib/npm';
import {
  createPackDir,
  packToPublishDir,
  rewritePackageJson
} from 'lib/utils';


// ---- Re-Pack ----------------------------------------------------------------

/**
 * Accepts a RePackOptions object and re-packs the host package according to the
 * provided configuration.
 */
export default async function rePack(userOptions: RePackArguments) {
  const runTime = log.createTimer();

  // Merge options with defaults.
  const opts = R.mergeAll([DEFAULT_OPTIONS, userOptions]) as Required<RePackArguments>;

  // Compute the absolute path to our working directory.
  const resolvedCwd = path.resolve(opts.cwd);
  log.verbose('cwd', resolvedCwd);

  // Compute the absolute path to our source directory.
  const resolvedHoistDir = path.resolve(opts.hoistDir);
  log.verbose('hoistDir', resolvedHoistDir);

  // eslint-disable-next-line prefer-const
  let [pkg, resolvedPackDir] = await Promise.all([
    // Gather information about the host package.
    getPkgInfo(resolvedCwd),
    // Compute the absolute path to the publish workspace, create the
    // directory if needed, and ensure it is empty.
    createPackDir(opts.packDir)
  ]);


  // ----- Prepare Package -----------------------------------------------------

  let hasLinkedPackage = false;

  const preparePackage = async () => {
    log.info(log.prefix('pack'), `${log.chalk.bold('Re-packing:')} ${log.chalk.green(pkg.json.name)}`);

    if (opts.watch) {
      // If in watch mode, re-read package.json to ensure we pick up changes.
      pkg = await getPkgInfo(resolvedCwd);
    }

    // Create a new package.json and write it to the publish workspace.
    await rewritePackageJson({
      pkgJson: pkg.json,
      hoistDir: resolvedHoistDir,
      packDir: resolvedPackDir
    });

    // Copy all files that would be included in the package's tarball to the
    // re-pack workspace, hoisting any files in the configured 'hoistDir' to the
    // workspace root.
    await packToPublishDir({
      pkgRoot: pkg.rootDir,
      hoistDir: opts.hoistDir,
      destDir: resolvedPackDir
    });

    // Once the package is re-packed, perform a one-time `npm link` if the user
    // passed the --link option.
    if (opts.link && !hasLinkedPackage) {
      await linkPackage(resolvedPackDir);
      // eslint-disable-next-line require-atomic-updates
      hasLinkedPackage = true;
    }
  };


  // ----- Watching ------------------------------------------------------------

  let watcher: chokidar.FSWatcher;

  if (opts.watch) {
    const lock = new AsyncLock();

    // Begin initial link & re-pack.
    await lock.acquire('re-pack', preparePackage);

    const filesToWatch = [
      path.resolve(pkg.rootDir, 'package.json'),
      resolvedHoistDir
    ];

    watcher = chokidar.watch(filesToWatch, {
      // cwd: pkg.rootDir,
      ignoreInitial: true,
      // Ignore source-maps and declaration files.
      ignored: ['**/*.js.map', '**/*.d.ts'],
      interval: 250
    });

    watcher.on('ready', () => {
      log.info(log.prefix('watch'), `Watching directory: ${log.chalk.green(resolvedHoistDir)}`);
    });

    watcher.on('all', (event, changed) => {
      log.info(log.prefix('watch'), `${log.chalk.gray(`${event}:`)} ${log.chalk.green(changed)}`);
      void lock.acquire('re-pack', preparePackage);
    });
  } else {
    // Perform a one-time repack only.
    await preparePackage();
  }

  // ----- Compute Return Value ------------------------------------------------

  return new Promise<string>(resolve => {
    // If using --watch, set up a POSIX handler that will close our watchers,
    // then exit.
    if (opts.watch) {
      adeiu(async () => {
        await watcher.close();
        resolve(resolvedPackDir);
      });

      return;
    }

    // Otherwise, log the total run time.
    log.info(log.prefix('pack'), `=> ${log.chalk.gray(resolvedPackDir)}`);
    log.info(log.prefix('pack'), log.chalk.bold(`Done in ${log.chalk.yellow(runTime)}.`));
    resolve(resolvedPackDir);
  });
}
