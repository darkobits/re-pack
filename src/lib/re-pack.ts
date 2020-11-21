import path from 'path';

import adeiu from '@darkobits/adeiu';
import AsyncLock from 'async-lock';
import chokidar from 'chokidar';
import * as R from 'ramda';

import { DEFAULT_OPTIONS } from 'etc/constants';
import { RePackOptions } from 'etc/types';
import log from 'lib/log';
import npm from 'lib/npm';
import {
  createPublishWorkspace,
  getPkgInfo,
  hoistSrcDir,
  packToPublishDir,
  rewritePackageJson,
  packDryRun
} from 'lib/utils';


// ---- Re-Pack ----------------------------------------------------------------

/**
 * Accepts a RePackOptions object and re-packs the host package according to the
 * provided configuration.
 */
export default async function rePack(userOptions: Required<RePackOptions>) {
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
    log.info(log.prefix('pack'), `Re-packing ${log.chalk.green(pkg.json.name)}`);

    // Create a new package.json and write it to the publish workspace.
    await rewritePackageJson(pkg.json, resolvedSrcDir, resolvedPackDir);

    // Use `npm pack` to collect all files to be published into a tarball, then
    // extract that tarball to the publish workspace.
    await packToPublishDir(pkg.rootDir, resolvedPackDir);

    // Hoist the configured build directory into the workspace root, then delete
    // it.
    await hoistSrcDir(resolvedPackDir, opts.srcDir);

    log.info(log.prefix('pack'), 'Done.');

    // Once the package is re-packed, perform a one-time `npm link` if the user
    // passed the --link option.
    if (opts.link && !hasLinkedPackage) {
      console.log('');
      log.info(log.prefix('link'), log.chalk.bold('Linking package...'));
      console.log('');

      await npm(['link', '--ignore-scripts'], {
        cwd: resolvedPackDir,
        stdio: 'inherit'
      });

      console.log('');
      log.info(log.prefix('link'), log.chalk.bold('Done.'));
      console.log('');

      hasLinkedPackage = true;
    }

    if (opts.publish) {
      // Run a --dry-run of `npm pack` from the publish workspace so the user can
      // verify package contents.
      await packDryRun(resolvedPackDir);
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

    watcher.on('ready', async () => {
      log.info(log.prefix('watch'), `Watching directory: ${log.chalk.green(resolvedSrcDir)}`);
    });

    watcher.on('all', (event, changed) => {
      log.info(log.prefix('watch'), `${log.chalk.gray(`${event}:`)} ${log.chalk.green(changed)}`);
      lock.acquire('re-pack', preparePackage);
    });
  }


  // ----- Publish (Not Watching) ----------------------------------------------

  if (opts.publish) {
    log.info(`Preparing package: ${log.chalk.green(pkg.json.name)}`);

    if (pkg.json.scripts?.prepublishOnly) {
      log.info(log.prefix('lifecycle'), 'Should run prepublishOnly here.');
    }

    if (pkg.json.scripts?.prepare) {
      log.info(log.prefix('lifecycle'), 'Should run prepublish here.');
    }

    // Prepare package.
    await preparePackage();

    // TODO: Perform tag detection to apply --tag option.
    log.info(log.prefix('publish'), 'Should run publish --ignore-scripts.');

    if (pkg.json.scripts?.postpublish) {
      log.info(log.prefix('lifecycle'), 'Should run postpublish here.');
    }
  }


  // ----- Compute Return Value ------------------------------------------------

  if (opts.watch) {
    return new Promise(resolve => {
      adeiu(() => {
        watcher.close().then(resolve);
      });
    })
  }

  return resolvedPackDir;
}
