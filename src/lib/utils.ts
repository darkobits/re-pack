import path from 'path';

import fs from 'fs-extra';
import ow from 'ow';
import * as R from 'ramda';
import readPkgUp, { NormalizedPackageJson } from 'read-pkg-up';
import semver from 'semver';
import tar from 'tar';
import tempy from 'tempy';

import { REWRITE_FIELDS } from 'etc/constants';
import log from 'lib/log';
import npm from 'lib/npm';


/**
 * Determines the "emptiness" of various data structures.
 */
export function isEmpty(value: any) {
  if (ow.isValid(value, ow.array)) {
    // If none of the elements in the array are truthy, consider it "empty".
    return R.none<any>(R.identity, value);
  }

  if (ow.isValid(value, ow.object)) {
    // If none of the object's values are truthy, consider it "empty".
    return R.none<any>(R.identity, R.values(value));
  }

  return R.isEmpty(value);
}


export interface PkgInfo {
  json: NormalizedPackageJson;
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
    throw new Error(`log.prefix('getPkgInfo') Unable to locate package root from: ${log.chalk.green(cwd)}`);
  }

  // Compute package root directory.
  const pkgRootDir = path.dirname(pkgInfo.path);
  const pkgJson = pkgInfo.packageJson;

  return {
    json: pkgJson,
    rootDir: pkgRootDir
  };
}


/**
 * Creates the temporary publish workspace in the host package's root and
 * ensures it is empty.
 */
export async function createPublishWorkspace(workspacePath?: string) {
  const computedPath = workspacePath ?? tempy.directory();

  // Ensure publish directory exists, creating any directories as-needed.
  try {
    await fs.ensureDir(computedPath);
  } catch (err) {
    throw new Error(`${log.prefix('createPublishWorkspace')} Unable to create publish workspace directory: ${err.message}`);
  }

  // Ensure the workspace is empty.
  try {
    await fs.emptyDir(computedPath);
  } catch (err) {
    throw new Error(`${log.prefix('createPublishWorkspace')} Unable to ensure publish workspace is empty: ${err.message}`);
  }

  log.verbose(log.prefix('createPublishWorkspace'), `Created publish workspace at: ${log.chalk.green(computedPath)}`);

  return computedPath;
}


/**
 * Modifies and writes to the publish workspace a new package.json with correct
 * paths based on the files hoisted from `pkgHoistDir`.
 *
 * Note. This function assumes the publish workspace has already been created
 * and can be written to.
 */
export async function rewritePackageJson(pkgJson: NormalizedPackageJson, pkgHoistDir: string, publishWorkspace: string) {
  const rewriteField = (value: string) => path.relative(pkgHoistDir, value);

  try {
    const newPkgJson = R.reduce((acc, curField) => {
      if (!R.has(curField, acc)) {
        return acc;
      }

      const curValue = pkgJson[curField];
      let newValue: typeof curValue;

      if (ow.isValid(curValue, ow.string)) {
        newValue = rewriteField(curValue);
      } else if (ow.isValid(curValue, ow.array.ofType(ow.string))) {
        newValue = R.map(rewriteField, curValue);
      } else if (ow.isValid(curValue, ow.object.valuesOfType(ow.string))) {
        newValue = R.mapObjIndexed(rewriteField, curValue);
      } else {
        throw new Error(`Encountered unknown field in package.json: ${log.chalk.yellow(curField)}`);
      }

      // If the field winds up being an empty object, empty array, or an empty
      // string, omit it from the re-written package.json.
      if (isEmpty(newValue)) {
        log.verbose(log.prefix('rewritePackageJson'), `Omitting empty/superfluous field: ${log.chalk.yellow(curField)}.`);
        return R.dissoc(curField, acc);
      }

      return R.assoc(curField, newValue, acc);
    }, pkgJson, REWRITE_FIELDS);

    // Write the new package.json to the publish workspace.
    await fs.writeJson(path.resolve(publishWorkspace, 'package.json'), newPkgJson, { spaces: 2 });
    log.verbose(log.prefix('rewritePackageJson'), `Wrote ${log.chalk.green('package.json')} to publish workspace.`);
  } catch (err) {
    throw new Error(`${log.prefix('rewritePackageJson')} Error re-writing package.json: ${err.message}`);
  }
}


/**
 * Packs and the unpacks the host package's publishable files to the publish
 * workspace using `npm pack`.
 *
 * Note: This function assumes the publish workspace has already been created.
 */
export async function packToPublishDir(pkgRoot: string, publishWorkspace: string) {
  const { stdout: tarballPath } = await npm(['pack', '--ignore-scripts'], { cwd: pkgRoot });

  // Extract tarball contents to publish directory. We use stripComponents=1
  // here because NPM puts all tarball contents under a 'package' directory
  // inside the tarball.
  await tar.extract({
    file: tarballPath,
    cwd: publishWorkspace,
    strip: 1,
    // Skip extracting package.json into the publish workspace because we will
    // write our own.
    filter: (filePath: string) => !filePath.includes('package.json')
  });

  // Remove the tarball.
  await fs.remove(tarballPath);
}


/**
 * Moves all files in `publishDir` to the publish workspace.
 *
 * Note. This function assumes that package artifacts have already been unpacked
 * into the publish workspace.
 */
export async function hoistSrcDir(publishWorkspace: string, publishDir: string) {
  try {
    const absPublishDir = path.resolve(publishWorkspace, publishDir);
    const publishDirStats = await fs.stat(absPublishDir);

    if (!publishDirStats.isDirectory) {
      throw new Error(`${log.prefix('hoistSrcDir')} "${log.chalk.green(publishDir)}" is not a directory.`);
    }

    // Get a list of all files in the publish workspace that will need to be
    // hoisted.
    const filesInPublishWorkspace = await fs.readdir(path.resolve(publishWorkspace, publishDir));
    log.verbose(log.prefix('hoistSrcDir'), 'Files in build directory to be hoisted:', filesInPublishWorkspace);

    // Move each file/folder up from the output directory to the publish
    // workspace.
    await Promise.all(filesInPublishWorkspace.map(async fileInPublishWorkspace => {
      const from = path.resolve(publishWorkspace, publishDir, fileInPublishWorkspace);
      const to = path.resolve(publishWorkspace, fileInPublishWorkspace);

      try {
        // Switched to true to support watch move
        await fs.move(from, to, { overwrite: true });
        log.verbose(log.prefix('hoistSrcDir'), `Moved file ${log.chalk.green(from)} => ${log.chalk.green(to)}.`);
      } catch (err) {
        throw new Error(`Unable to move file ${log.chalk.green(from)} to ${log.chalk.green(to)}: ${err.message}`);
      }
    }));

    // Remove the (hopefully empty) `publishDir` directory now that all files
    // and folders therein have been hoisted.
    log.silly(log.prefix('hoistSrcDir'), `Removing build directory ${log.chalk.green(absPublishDir)}`);
    await fs.rmdir(absPublishDir);
    log.verbose(log.prefix('hoistSrcDir'), `Hoisted files from ${log.chalk.green(absPublishDir)} to publish root.`);
  } catch (err) {
    throw new Error(`${log.prefix('hoistSrcDir')} Error hoisting file/directory: ${err.message}`);
  }
}


/**
 * Provided a valid semver string, determines if it contains a prerelease
 * component (ex: 'beta') and returns it.
 */
export function inferPublishTag(packageVersion: string) {
  const parsed = semver.parse(packageVersion, { includePrerelease: true });

  if (!parsed) {
    return;
  }

  if (parsed.prerelease.length > 0) {
    const prereleaseTag = parsed.prerelease[0];

    if (typeof prereleaseTag === 'string') {
      return prereleaseTag;
    }
  }
}


/**
 * @deprecated - NPM does not support publishing symlinks.
 *
 * Provided the path to a publish workspace and a map of symlinks to create,
 * creates each symlink.
 *
 * Note: This function assumes that the "hoisting" phase has already been
 * completed.
 */
export async function symlinkEntries(publishWorkspace: string, entries: Array<{from: string; to: string}>) {
  try {
    await Promise.all(R.map(async ({ from, to }) => {
      const absolutePathToLinkDestination = path.resolve(publishWorkspace, from);
      await fs.ensureSymlink(to, absolutePathToLinkDestination);
      log.info(log.prefix('entry'), `${log.chalk.green.bold(from)} ${log.chalk.bold('→')} ${log.chalk.green(to)}`);
    }, entries));
  } catch (err) {
    throw new Error(`${log.prefix('symlinkEntries')} Error creating symlink: ${err.message}`);
  }
}
