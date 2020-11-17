import path from 'path';
import { RePackOptions } from 'etc/types';
import log from 'lib/log';
import {
  createPublishWorkspace,
  getPkgInfo,
  hoistBuildDir,
  packToPublishWorkspace,
  rewritePackageJson,
  packDryRun
} from 'lib/utils';


// ---- Re-Pack ----------------------------------------------------------------

/**
 * Accepts a RePackOptions object and re-packs the host package according to the
 * provided configuration.
 */
export default async function rePack(opts: RePackOptions) {
  const { cwd, buildDir, workspaceDir } = opts;
  const resolvedCwd = path.resolve(cwd ?? process.cwd());
  const resolvedBuildDir = path.resolve(buildDir);

  const [pkg, publishWorkspace] = await Promise.all([
    // Gather information about the host package.
    getPkgInfo(resolvedCwd),
    // Compute the absolute path to the publish workspace, create the
    // directory if needed, and ensure it is empty.
    createPublishWorkspace(workspaceDir)
  ]);

  log.info(`Preparing package: ${log.chalk.green(pkg.json.name)}`);

  // Create a new package.json and write it to the publish workspace.
  await rewritePackageJson(pkg.json, resolvedBuildDir, publishWorkspace);

  // Use `npm pack` to collect all files to be published into a tarball, then
  // extract that tarball to the publish workspace.
  await packToPublishWorkspace(pkg.rootDir, publishWorkspace);

  // Hoist the configured build directory into the workspace root, then delete
  // it.
  await hoistBuildDir(publishWorkspace, buildDir);

  // Run a --dry-run of `npm pack` from the publish workspace so the user can
  // verify package contents.
  await packDryRun(publishWorkspace);

  return publishWorkspace;
}
