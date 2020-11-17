#!/usr/bin/env node

import cli from '@darkobits/saffron';

import {
  RePackCliOptions
} from 'etc/types';
import log from 'lib/log';
import rePack from 'lib/re-pack';


cli.command<RePackCliOptions>({
  command: '* [cwd]',
  config: {
    fileName: 're-pack',
    auto: false
  },
  builder: ({ command }) => {
    command.positional('cwd', {
      description: 'Directory containing the NPM package to run re-pack on.',
      type: 'string',
      default: 'process.cwd()'
    });

    command.option('publish', {
      description: 'Whether to run "npm publish" after re-pack has run.',
      type: 'boolean',
      default: false,
      required: false
    });

    command.option('dist-dir', {
      description: 'Directory containing build artifacts to hoist.',
      type: 'string',
      default: 'dist',
      required: false
    });

    command.option('out-dir', {
      description: 'Directory where re-pack will stage the host package.',
      type: 'string',
      default: '.re-pack'
    });
  },
  handler: async ({ argv, config }) => {
    try {
      const runTime = log.createTimer();

      // Not implemented yet.
      const publish = config?.publish ?? argv.publish;

      const workspaceDir = await rePack({
        buildDir: argv.distDir,
        workspaceDir: argv.outDir
      });

      log.info(`Done. ${log.chalk.dim(`(${runTime})`)}`);

      if (!publish) {
        log.info(`To publish your package, run ${log.chalk.bold(`npm publish ${workspaceDir}`)}`);
      }
    } catch (err) {
      log.error(err.message);
      log.verbose(err.stack.split('\n').slice(1).join('\n'));
      process.exit(1);
    }
  }
});


cli.init();
