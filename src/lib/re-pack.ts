import path from 'path'

import adeiu from '@darkobits/adeiu'
import AsyncLock from 'async-lock'
import chokidar, { type FSWatcher } from 'chokidar'
import fs from 'fs-extra'
import * as R from 'ramda'

import { DEFAULT_OPTIONS } from 'etc/constants'
import {
  RePackArguments,
  RePackConfiguration
} from 'etc/types'
import log from 'lib/log'
import {
  getPackList,
  linkPackage
} from 'lib/npm'
import {
  createPackDir,
  getPackageInfo,
  rewritePackageJson
} from 'lib/utils'

/**
 * Packs and the unpacks the host package's publishable files to the publish
 * workspace using `npm pack`.
 *
 * Note: This function assumes the publish workspace has already been created.
 */
export interface PackToPublishDirOptions {
  /**
   * Root directory of the NPM package to re-pack.
   */
  pkgRoot: string

  /**
   * Directory from which to hoist files to the root of the destination
   * directory.
   */
  hoistDir: string

  /**
   * Directory to write files to.
   */
  destDir: string
}

export async function packToPublishDir({ pkgRoot, hoistDir, destDir }: PackToPublishDirOptions) {
  const srcFiles: Array<string> = await getPackList(pkgRoot)

  await Promise.all(srcFiles.map(async srcFile => {
    // Skip package.json, as we re-write it manually elsewhere.
    if (path.basename(srcFile) === 'package.json') {
      return
    }

    const resolvedSrcFile = path.resolve(pkgRoot, srcFile)
    const resolvedDestFile = path.resolve(destDir, srcFile.replace(new RegExp(`^${hoistDir}${path.sep}`), ''))
    log.trace(log.chalk.cyan.dim('packToPublishDir'), `Copy ${log.chalk.green(resolvedSrcFile)} => ${log.chalk.green(resolvedDestFile)}`)
    await fs.copy(resolvedSrcFile, resolvedDestFile, { overwrite: true })
  }))
}

// ---- Re-Pack ----------------------------------------------------------------

/**
 * Accepts a RePackOptions object and re-packs the host package according to the
 * provided configuration.
 */
export default async function rePack(userOptions: RePackArguments & RePackConfiguration) {
  const runTime = log.chronograph()
  const prefix = log.chalk.cyan.dim('pack')

  // Merge options with defaults.
  const opts = R.mergeAll([DEFAULT_OPTIONS, userOptions]) as Required<RePackArguments> & RePackConfiguration

  // Compute the absolute path to our working directory.
  const resolvedCwd = path.resolve(opts.cwd)
  log.verbose(prefix, `cwd: ${log.chalk.green(resolvedCwd)}`)

  // Compute the absolute path to our source directory.
  const resolvedHoistDir = path.resolve(opts.hoistDir)

  // eslint-disable-next-line prefer-const
  let [pkg, resolvedPackDir] = await Promise.all([
    // Gather information about the host package.
    getPackageInfo(resolvedCwd),
    // Compute the absolute path to the publish workspace, create the
    // directory if needed, and ensure it is empty.
    createPackDir(opts.packDir)
  ])

  // ----- Prepare Package -----------------------------------------------------

  let hasLinkedPackage = false

  const preparePackage = async () => {
    log.info(prefix, `${log.chalk.bold('Re-packing:')} ${log.chalk.green(pkg.json.name)}`)

    // If in watch mode, re-read package.json to ensure we pick up changes.
    // eslint-disable-next-line require-atomic-updates
    if (opts.watch) pkg = await getPackageInfo(resolvedCwd)

    // Create a new package.json and write it to the publish workspace.
    await rewritePackageJson({
      pkgJson: pkg.json,
      hoistDir: opts.hoistDir,
      packDir: resolvedPackDir
    })

    // Copy all files that would be included in the package's tarball to the
    // re-pack workspace, hoisting any files in the configured 'hoistDir' to the
    // workspace root.
    await packToPublishDir({
      pkgRoot: pkg.root,
      hoistDir: opts.hoistDir,
      destDir: resolvedPackDir
    })

    if (typeof opts.afterRepack === 'function') {
      try {
        await opts.afterRepack({ fs, packDir: resolvedPackDir })
      } catch (err: any) {
        err.message = `${prefix} ${err.message}`
        throw err
      }
    }

    // Once the package is re-packed, perform a one-time `npm link` if the user
    // passed the --link option.
    if (opts.link && !hasLinkedPackage) {
      await linkPackage(resolvedPackDir)
      // eslint-disable-next-line require-atomic-updates
      hasLinkedPackage = true
    }
  }

  // ----- Watching ------------------------------------------------------------

  let watcher: FSWatcher

  if (opts.watch) {
    const lock = new AsyncLock()

    // Begin initial link & re-pack.
    await lock.acquire('re-pack', preparePackage)

    const filesToWatch = [
      path.resolve(pkg.root, 'package.json'),
      resolvedHoistDir
    ]

    watcher = chokidar.watch(filesToWatch, {
      // cwd: pkg.root,
      ignoreInitial: true,
      // Ignore source-maps and declaration files.
      ignored: ['**/*.js.map', '**/*.d.ts'],
      interval: 250
    })

    watcher.on('ready', () => {
      log.info(log.chalk.cyan.dim('watch'), `Watching directory: ${log.chalk.green(resolvedHoistDir)}`)
    })

    watcher.on('all', (event, changed) => {
      log.info(log.chalk.cyan.dim('watch'), `${log.chalk.gray(`${event}:`)} ${log.chalk.green(changed)}`)
      void lock.acquire('re-pack', preparePackage)
    })
  } else {
    // Perform a one-time repack only.
    await preparePackage()
  }

  // ----- Compute Return Value ------------------------------------------------

  return new Promise<string>(resolve => {
    // If using --watch, set up a POSIX handler that will close our watchers,
    // then exit.
    if (opts.watch) {
      adeiu(async () => {
        await watcher.close()
        resolve(resolvedPackDir)
      })

      return
    }

    // Otherwise, log the total run time.
    log.info(prefix, `=> ${log.chalk.gray(resolvedPackDir)}`)
    log.info(prefix, log.chalk.bold(`Done in ${log.chalk.yellow(runTime)}.`))
    resolve(resolvedPackDir)
  })
}