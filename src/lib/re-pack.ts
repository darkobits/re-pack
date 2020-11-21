import path from 'path';

import adeiu from '@darkobits/adeiu';
import AsyncLock from 'async-lock';
import chokidar from 'chokidar';
import * as R from 'ramda';

import { DEFAULT_OPTIONS } from 'etc/constants';
import { RePackOptions } from 'etc/types';
import log from 'lib/log';
import {
  linkPackage,
  runLifecycleScript,
  publishPackage
} from 'lib/npm';
import {
  createPublishWorkspace,
  getPkgInfo,
  hoistSrcDir,
  packToPublishDir,
  rewritePackageJson,
  inferPublishTag
} from 'lib/utils';


// ---- Re-Pack ----------------------------------------------------------------

/**
 * Accepts a RePackOptions object and re-packs the host package according to the
 * provided configuration.
 */
export default async function rePack(userOptions: Required<RePackOptions>) {
  const runTime = log.createTimer();

  // Merge options with defaults.
  const opts = R.mergeAll([DEFAULT_OPTIONS, userOptions]);

  if (opts.publish && opts.watch) {
    throw new Error('Options "publish" and "watch" are mutually exclusive.');
  }

  if (opts.publish && opts.link) {
    throw new Error('Options "publish" and "link" are mutually exclusive.');
  }

  // Compute the absolute path to our working directory.
  const resolvedCwd = path.resolve(opts.cwd);
  log.verbose('cwd', resolvedCwd);

  // Compute the absolute path to our source directory.
  const resolvedSrcDir = path.resolve(opts.srcDir);
  log.verbose('srcDir', resolvedSrcDir);

  const [pkg, resolvedPackDir] = await Promise.all([
    // Gather information about the host package.
    getPkgInfo(resolvedCwd),
    // Compute the absolute path to the publish workspace, create the
    // directory if needed, and ensure it is empty.
    createPublishWorkspace(opts.packDir)
  ]);
  log.verbose('packDir', resolvedPackDir);


  // ----- Prepare Package -----------------------------------------------------

  let hasLinkedPackage = false;

  const preparePackage = async () => {
    log.info(log.prefix('pack'), `${log.chalk.bold('Re-packing')} ${log.chalk.green(pkg.json.name)}`);

    // Create a new package.json and write it to the publish workspace.
    await rewritePackageJson(pkg.json, resolvedSrcDir, resolvedPackDir);

    // Use `npm pack` to collect all files to be published into a tarball, then
    // extract that tarball to the publish workspace.
    await packToPublishDir(pkg.rootDir, resolvedPackDir);

    // Hoist the configured build directory into the workspace root, then delete
    // it.
    await hoistSrcDir(resolvedPackDir, opts.srcDir);

    if (opts.watch || opts.link) {
      log.info(log.prefix('pack'), log.chalk.bold('Done.'));
    }

    // Once the package is re-packed, perform a one-time `npm link` if the user
    // passed the --link option.
    if (opts.link && !hasLinkedPackage) {
      await linkPackage(resolvedPackDir);
      // eslint-disable-next-line require-atomic-updates
      hasLinkedPackage = true;
      return;
    }

    // If the user passed the --publish option, publish the package.
    if (opts.publish) {
      await publishPackage({
        cwd: resolvedPackDir,
        dryRun: opts.dryRun,
        tag: inferPublishTag(pkg.json.version)
      });
    }
  };


  // ----- Watching (Not Publishing) -------------------------------------------

  let watcher: chokidar.FSWatcher;

  if (opts.watch) {
    const lock = new AsyncLock();

    // Begin initial link & re-pack.
    await lock.acquire('re-pack', preparePackage);

    const filesToWatch = [
      path.resolve(pkg.rootDir, 'package.json'),
      resolvedSrcDir
    ];

    watcher = chokidar.watch(filesToWatch, {
      cwd: pkg.rootDir,
      ignoreInitial: true,
      // Ignore source-maps and declaration files.
      ignored: ['**/*.js.map', '**/*.d.ts'],
      interval: 250
    });

    watcher.on('ready', () => {
      log.info(log.prefix('watch'), `Watching directory: ${log.chalk.green(resolvedSrcDir)}`);
    });

    watcher.on('all', (event, changed) => {
      log.info(log.prefix('watch'), `${log.chalk.gray(`${event}:`)} ${log.chalk.green(changed)}`);
      void lock.acquire('re-pack', preparePackage);
    });
  }


  // ----- Publish (Not Watching) ----------------------------------------------

  if (opts.publish) {
    log.info(`Preparing package: ${log.chalk.green(pkg.json.name)}`);

    // Run prepublishOnly script.
    if (pkg.json.scripts?.prepublishOnly) {
      await runLifecycleScript({
        cwd: pkg.rootDir,
        scriptName: 'prepublishOnly'
      });
    }

    // Run prepare script.
    if (pkg.json.scripts?.prepare) {
      await runLifecycleScript({
        cwd: pkg.rootDir,
        scriptName: 'prepare'
      });
    }

    // Re-pack & publish package.
    await preparePackage();

    // Run postpublish script.
    if (pkg.json.scripts?.postpublish) {
      await runLifecycleScript({
        cwd: pkg.rootDir,
        scriptName: 'postpublish'
      });
    }
  }


  // ----- Re-Pack Only --------------------------------------------------------

  if (!opts.watch && !opts.publish) {
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
    log.info(log.chalk.bold(`Done in ${log.chalk.yellow(runTime)}.`));
    resolve(resolvedPackDir);
  });
}
