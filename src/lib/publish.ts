import path from 'path'

import * as R from 'ramda'

import { DEFAULT_PUBLISH_OPTIONS } from 'etc/constants'
import {
  PublishArguments,
  RePackConfiguration
} from 'etc/types'
import config from 'lib/config'
import log from 'lib/log'
import {
  runLifecycleScript,
  publishPackage
} from 'lib/npm'
import rePack from 'lib/re-pack'
import { getPackageInfo, inferPublishTag } from 'lib/utils'

// ---- Publish ----------------------------------------------------------------

/**
 * Re-packs and publishes the host package.
 *
 * TODO: Add --access and --tag arguments.
 */
export default async function publish(userOptions: PublishArguments & RePackConfiguration) {
  try {
    const runTime = log.chronograph()
    const prefix = log.chalk.cyan.dim('publish')
    config.set('isPublishing', true)

    // Merge options with defaults.
    const opts = R.mergeAll([DEFAULT_PUBLISH_OPTIONS, userOptions]) as Required<PublishArguments> & RePackConfiguration

    // Compute the absolute path to our working directory.
    const resolvedCwd = path.resolve(opts.cwd)
    log.verbose(prefix, `cwd: ${log.chalk.green(resolvedCwd)}`)

    // Get package information.
    const pkg = await getPackageInfo(resolvedCwd)
    log.info(prefix, [
      `Preparing to publish package: ${log.chalk.green(`${pkg.json.name}@${pkg.json.version}`)}`,
      opts.dryRun ? log.chalk.gray('(dry run)') : false
    ].filter(Boolean).join(' '))

    // Compute dist-tag.
    const tag = opts.tag ?? inferPublishTag(pkg.json.version)
    if (tag) log.info(prefix, `Using dist-tag: ${log.chalk.yellow(tag)}`)

    // Run the "prepublishOnly" script on the _root_ package.
    if (pkg.json.scripts?.prepublishOnly) {
      log.verbose(prefix, `Running ${log.chalk.green('"prepublishOnly"')} lifecycle script.`)
      await runLifecycleScript({ cwd: pkg.root, scriptName: 'prepublishOnly' })
    } else if (!config.get('hasSeenPrepublishWarning')) {
      // Issue a one-time warning about installing the publish guard.
      log.warn(prefix, `Consider adding a ${log.chalk.green('"prepublishOnly"')} package script that runs ${log.chalk.bold('re-pack guard')}.`)
      log.warn(prefix, log.chalk.gray('This warning will not be displayed again.'))
      config.set('hasSeenPrepublishWarning', true)
    }

    // Run the "prepare" script on the _root_ package.
    if (pkg.json.scripts?.prepare) {
      log.verbose(prefix, `Running ${log.chalk.green('"prepare"')} lifecycle script.`)
      await runLifecycleScript({ cwd: pkg.root, scriptName: 'prepare' })
    }

    // Re-pack package.
    await rePack({
      cwd: opts.cwd,
      // N.B. We want to pass the plain hoistDir here, not the resolved one, as
      // this function will be working with relative paths within the package.
      hoistDir: opts.hoistDir,
      packDir: opts.packDir,
      afterRepack: opts.afterRepack
    })

    // Publish re-packed package.
    await publishPackage({
      cwd: opts.packDir,
      dryRun: opts.dryRun,
      tag
    })

    // Run the "postpublish" script on the _root_ package.
    if (pkg.json.scripts?.postpublish) {
      log.verbose(prefix, `Running ${log.chalk.green('"postpublish"')} lifecycle script.`)
      await runLifecycleScript({ cwd: pkg.root, scriptName: 'postpublish' })
    }

    log.info(prefix, log.chalk.bold(`Done in ${log.chalk.yellow(runTime)}.`))
  } finally {
    config.set('isPublishing', false)
  }
}