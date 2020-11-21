#!/usr/bin/env node

import adeiu from '@darkobits/adeiu';
import cli from '@darkobits/saffron';

import { DEFAULT_OPTIONS } from 'etc/constants';
import { RePackOptions } from 'etc/types';
import log from 'lib/log';
import rePack from 'lib/re-pack';


cli.command<Required<RePackOptions>>({
  command: '* [cwd]',
  config: {
    fileName: 're-pack',
    auto: false
  },
  builder: ({ command }) => {
    command.positional('cwd', {
      description: 'Root directory of the NPM package to re-pack.',
      type: 'string',
      required: false,
      default: DEFAULT_OPTIONS.cwd
    });

    command.option('src-dir', {
      description: 'Directory (typically containing build artifacts) to hoist to the package root.',
      type: 'string',
      required: false,
      default: DEFAULT_OPTIONS.srcDir
    });

    command.option('pack-dir', {
      description: 'Directory where the package will be re-packed.',
      type: 'string',
      default: DEFAULT_OPTIONS.packDir
    });

    command.option('publish', {
      description: 'Whether to run "npm publish" after re-pack has run.',
      type: 'boolean',
      required: false,
      default: DEFAULT_OPTIONS.publish
    });

    command.option('dry-run', {
      description: 'Whether to pass --dry-run to `npm publish`.',
      type: 'boolean',
      required: false,
      default: DEFAULT_OPTIONS.dryRun
    });

    command.option('watch', {
      description: 'If true, continuously watches dist-dir and re-packs to out-dir.',
      type: 'boolean',
      required: false,
      default: DEFAULT_OPTIONS.watch
    });

    command.option('link', {
      description: 'If true, runs `npm link` from the re-pack directory.',
      type: 'boolean',
      required: false,
      default: DEFAULT_OPTIONS.link
    });
  },
  handler: async ({ argv }) => {
    try {
      // Not implemented yet. Will need to remove defaults above so that args
      // will take precedence over config, then swap logic below.
      // const publish = argv?.publish ?? config?.publish;

      adeiu(signal => {
        if (argv.watch) {
          log.info(`Got signal ${log.chalk.yellow(signal)}; closing watcher.`);
        }
      });

      await rePack(argv);
    } catch (err) {
      log.error(err.message);
      log.verbose(err.stack.split('\n').slice(1).join('\n'));
      process.exit(1);
    }
  }
});


cli.init();
