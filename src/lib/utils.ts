import path from 'path';

import fs from 'fs-extra';
import ow from 'ow';
import * as R from 'ramda';
import readPackageUp, { NormalizedPackageJson } from 'read-pkg-up';
import semver from 'semver';
import tempy from 'tempy';

import { REWRITE_FIELDS } from 'etc/constants';
import log from 'lib/log';
import { getPackList } from 'lib/npm';


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
  const pkgInfo = await readPackageUp({ cwd });

  if (!pkgInfo) {
    throw new Error(`${log.prefix('getPkgInfo')} Unable to locate package root from: ${log.chalk.green(cwd)}`);
  }

  const rootDir = path.dirname(pkgInfo.path);
  const json = pkgInfo.packageJson;

  return { json, rootDir };
}


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


/**
 * Creates the directory to which the host package will be re-packed.
 */
export async function createPackDir(workspacePath?: string) {
  const resolvedPackDir = workspacePath ? path.resolve(workspacePath) : tempy.directory();

  // Ensure re-pack directory exists, creating any directories as-needed.
  try {
    await fs.ensureDir(resolvedPackDir);
  } catch (err: any) {
    err.message = `${log.prefix('createPackDir')} Unable to create re-pack directory: ${err.message}`;
    throw err;
  }

  // Ensure the re-pack directory is empty, deleting files as needed.
  try {
    await fs.emptyDir(resolvedPackDir);
  } catch (err: any) {
    err.message = `${log.prefix('createPackDir')} Unable to ensure publish workspace is empty: ${err.message}`;
    throw err;
  }

  log.verbose(log.prefix('createPackDir'), `Created re-pack directory: ${log.chalk.green(resolvedPackDir)}`);

  return resolvedPackDir;
}


/**
 * Modifies and writes to the publish workspace a new package.json with correct
 * paths based on the files hoisted from `hoistDir`.
 *
 * Note. This function assumes the publish workspace has already been created
 * and can be written to.
 */
export interface RewritePackageJsonOptions {
  /**
   * Normalized package.json data to re-write.
   */
  pkgJson: NormalizedPackageJson;

  /**
   * Sub-directory in the local project that will become the root directory in
   * the re-packed project. Usually 'dist' or 'lib'.
   */
  hoistDir: string;

  /**
   * Directory to which re-written package.json will be written.
   */
  packDir: string;
}

export async function rewritePackageJson({ pkgJson, hoistDir, packDir }: RewritePackageJsonOptions) {
  const rewriteField = (value: string) => {
    const relativePath = path.relative(hoistDir, value);

    if (relativePath) {
      return `./${path.relative(hoistDir, value)}`;
    }

    return relativePath;
  };

  try {
    // @ts-expect-error
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
    await fs.writeJson(path.resolve(packDir, 'package.json'), newPkgJson, { spaces: 2 });
    log.verbose(log.prefix('rewritePackageJson'), `Wrote ${log.chalk.green('package.json')} to publish workspace.`);
  } catch (err: any) {
    throw new Error(`${log.prefix('rewritePackageJson')} Error re-writing package.json: ${err.message}`);
  }
}


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
  pkgRoot: string;

  /**
   * Directory from which to hoist files to the root of the destination
   * directory.
   */
  hoistDir: string;

  /**
   * Directory to write files to.
   */
  destDir: string;
}

export async function packToPublishDir({ pkgRoot, hoistDir, destDir }: PackToPublishDirOptions) {
  const srcFiles: Array<string> = await getPackList(pkgRoot);

  await Promise.all(srcFiles.map(async srcFile => {
    // Skip package.json, as we re-write it manually elsewhere.
    if (path.basename(srcFile) === 'package.json') {
      return;
    }

    const resolvedSrcFile = path.resolve(pkgRoot, srcFile);
    const resolvedDestFile = path.resolve(destDir, srcFile.replace(new RegExp(`^${hoistDir}${path.sep}`), ''));
    log.silly(log.prefix('packToPublishDir'), `Copy ${log.chalk.green(resolvedSrcFile)} => ${log.chalk.green(resolvedDestFile)}`);
    await fs.copy(resolvedSrcFile, resolvedDestFile, { overwrite: true });
  }));
}


/**
 * Provided a valid semver string, determines if it contains a prerelease
 * component (ex: 'beta') and returns it.
 */
export function inferPublishTag(pkgVersion: string) {
  // @ts-expect-error - Typings appear to be broken in most recent version.
  const parsed = semver.parse(pkgVersion, { includePrerelease: true });

  if (parsed && parsed.prerelease.length > 0 && typeof parsed.prerelease[0] === 'string') {
    return parsed.prerelease[0];
  }
}


export async function temporarilyRemoveProblematicPackageScripts(pkgInfo: PkgInfo) {
  const pkgJsonPath = path.join(pkgInfo.rootDir, 'package.json');

  const clonedPackageJson = R.clone(pkgInfo.json);

  // Remove "prepare" script if it is present.
  const prepareScript = R.path<string>(['scripts', 'prepare'], clonedPackageJson);

  if (prepareScript && clonedPackageJson.scripts) {
    log.warn(log.prefix('link'), `Blocking invocation of prepare script: ${log.chalk.green(`"${prepareScript}"`)}`);
    Reflect.deleteProperty(clonedPackageJson.scripts, 'prepare');
  }

  // Remove "prepublishOnly" script if it is present.
  const prepublishOnlyScript = R.path<string>(['scripts', 'prepublishOnly'], clonedPackageJson);

  if (prepublishOnlyScript && clonedPackageJson.scripts) {
    log.warn(log.prefix('link'), `Blocking invocation of prepublishOnly script: ${log.chalk.green(`"${prepublishOnlyScript}"`)}`);
    Reflect.deleteProperty(clonedPackageJson.scripts, 'prepublishOnly');
  }

  // Write modified package.json.
  await fs.writeJSON(pkgJsonPath, clonedPackageJson, { spaces: 2 });

  // Return a function that will restore the original package.json.
  return async () => {
    await fs.writeJSON(pkgJsonPath, pkgInfo.json, { spaces: 2 });
  };
}
