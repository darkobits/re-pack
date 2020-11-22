import path from 'path';

import * as R from 'ramda';

import { DEFAULT_PUBLISH_OPTIONS } from 'etc/constants';
import { PublishArguments } from 'etc/types';
import config from 'lib/config';
import log from 'lib/log';
import {
  getPkgInfo,
  runLifecycleScript,
  publishPackage
} from 'lib/npm';
import { inferPublishTag } from 'lib/utils';
import rePack from 'lib/re-pack';


// ---- Publish ----------------------------------------------------------------

/**
 * Re-packs and publishes the host package.
 *
 * TODO: Add --access and --tag arguments.
 */
export default async function publish(userOptions: PublishArguments) {
  try {
    const runTime = log.createTimer();

    // Merge options with defaults.
    const opts = R.mergeAll([DEFAULT_PUBLISH_OPTIONS, userOptions]) as Required<PublishArguments>;

    // Compute the absolute path to our working directory.
    const resolvedCwd = path.resolve(opts.cwd);
    log.verbose(log.prefix('publish'), `cwd: ${log.chalk.green(resolvedCwd)}`);

    // Get package information.
    const pkg = await getPkgInfo(resolvedCwd);
    const tag = opts.tag ?? inferPublishTag(pkg.json.version);


    log.info(log.prefix('publish'), `Preparing to publish package: ${log.chalk.green(pkg.json.name)}`);
    log.info(log.prefix('publish'), `Using dist-tag ${tag}`);

    config.set('isPublishing', true);
    config.set('hasSeenPrepublishWarning', false);

    // Run prepublishOnly script on _root_ package.
    if (pkg.json.scripts?.prepublishOnly) {
      log.info(log.prefix('publish'), `Running ${log.chalk.green('"prepublishOnly"')} lifecycle script.`);
      await runLifecycleScript({
        cwd: pkg.rootDir,
        scriptName: 'prepublishOnly'
      });
    } else if (!config.get('hasSeenPrepublishWarning')) {
      log.warn(log.prefix('publish'), `Consider adding a ${log.chalk.green('"prepublishOnly"')} package script that runs ${log.chalk.bold('re-pack check')}.`);
      log.warn(log.prefix('publish'), log.chalk.gray('This warning will not be displayed again.'));
      config.set('hasSeenPrepublishWarning', true);
    }

    // Run prepare script on _root_ package.
    if (pkg.json.scripts?.prepare) {
      log.info(log.prefix('publish'), `Running ${log.chalk.green('"prepare"')} lifecycle script.`);
      await runLifecycleScript({
        cwd: pkg.rootDir,
        scriptName: 'prepare'
      });
    }

    // Re-pack package.
    await rePack({
      cwd: opts.cwd,
      hoistDir: opts.hoistDir,
      packDir: opts.packDir,
      watch: false,
      link: false
    });

    // Publish re-packed package.
    await publishPackage({
      pkgRoot: opts.packDir,
      dryRun: opts.dryRun,
      // TODO: Support custom --tag option.
      tag: inferPublishTag(pkg.json.version)
    });

    // Run postpublish script.
    if (pkg.json.scripts?.postpublish) {
      log.info(log.prefix('publish'), `Running ${log.chalk.green('"postpublish"')} lifecycle script.`);
      await runLifecycleScript({
        cwd: pkg.rootDir,
        scriptName: 'postpublish'
      });
    }

    log.info(log.prefix('publish'), log.chalk.bold(`Done in ${log.chalk.yellow(runTime)}.`));
  } finally {
    config.set('isPublishing', false);
  }
}
