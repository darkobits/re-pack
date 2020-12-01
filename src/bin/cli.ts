#!/usr/bin/env node

import adeiu from '@darkobits/adeiu';
import cli from '@darkobits/saffron';

import {
  DEFAULT_OPTIONS,
  DEFAULT_PUBLISH_OPTIONS
} from 'etc/constants';
import {
  RePackArguments,
  RePackConfiguration,
  PublishArguments
} from 'etc/types';
import log from 'lib/log';

import config from 'lib/config';
import rePack from 'lib/re-pack';
import publish from 'lib/publish';
import publishGuard from 'lib/publish-guard';


const DESCRIPTIONS = {
  HOIST_DIR: 'Directory to hoist to the re-pack root.',
  PACK_DIR: 'Directory where the package will be re-packed.'
};

// ----- Re-Pack ---------------------------------------------------------------

cli.command<Required<RePackArguments>, RePackConfiguration>({
  command: '* [cwd]',
  description: 'Re-pack the host package.',
  config: {
    fileName: 're-pack',
    auto: false
  },
  builder: ({ command }) => {
    command.positional('cwd', {
      description: 'Root directory of the package to re-pack. [default: cwd]',
      type: 'string',
      required: false
    });

    command.option('hoist-dir', {
      description: DESCRIPTIONS.HOIST_DIR,
      type: 'string',
      required: false,
      default: DEFAULT_OPTIONS.hoistDir
    });

    command.option('pack-dir', {
      description: DESCRIPTIONS.PACK_DIR,
      type: 'string',
      default: DEFAULT_OPTIONS.packDir
    });

    command.option('watch', {
      description: `Continuously watches ${log.chalk.bold('hoist-dir')} and re-packs to ${log.chalk.bold('pack-dir')}.`,
      type: 'boolean',
      required: false,
      default: DEFAULT_OPTIONS.watch
    });

    command.option('link', {
      description: `After re-packing, runs ${log.chalk.bold('npm link')} from ${log.chalk.bold('pack-dir')}.`,
      type: 'boolean',
      required: false,
      default: DEFAULT_OPTIONS.link
    });
  },
  handler: async ({ argv, config, configPath }) => {
    try {
      log.info('configPath', configPath);
      log.info('config', config);

      adeiu(signal => {
        if (argv.watch) {
          log.info(`Got signal ${log.chalk.yellow(signal)}; closing watcher.`);
        }
      });

      await rePack({
        ...argv,
        ...config
      });
    } catch (err) {
      log.error(err.message);
      log.verbose(err.stack.split('\n').slice(1).join('\n'));
      process.exit(1);
    }
  }
});


// ----- Publish ---------------------------------------------------------------

cli.command<Required<PublishArguments>, RePackConfiguration>({
  command: 'publish',
  description: 'Re-pack and publish the host package.',
  config: {
    fileName: 're-pack',
    auto: false
  },
  builder: ({ command }) => {
    command.positional('cwd', {
      description: 'Root directory of the package to re-pack and publish. [default: cwd]',
      type: 'string',
      required: false
    });

    command.option('hoist-dir', {
      description: DESCRIPTIONS.HOIST_DIR,
      type: 'string',
      required: false,
      default: DEFAULT_PUBLISH_OPTIONS.hoistDir
    });

    command.option('pack-dir', {
      description: DESCRIPTIONS.PACK_DIR,
      type: 'string',
      default: DEFAULT_PUBLISH_OPTIONS.packDir
    });

    command.option('tag', {
      description: [
        'Distribution tag to publish the package under. If the current',
        'package version contains a pre-release token (ex: beta), it',
        `will be used.\nForwards to the --tag argument of ${log.chalk.bold('npm publish')}.`
      ].join('\n'),
      type: 'boolean',
      required: false
    });

    command.option('access', {
      description: `Access to set on the published package.\nForwards to the --access argument of ${log.chalk.bold('npm publish')}.`,
      choices: ['public', 'restricted'],
      type: 'string',
      required: false
    });

    command.option('dry-run', {
      description: `Forwards to the --dry-run argument of ${log.chalk.bold('npm publish')}.`,
      type: 'boolean',
      required: false,
      default: DEFAULT_PUBLISH_OPTIONS.dryRun
    });

    // command.wrap(128);
  },
  handler: async ({ argv, config }) => {
    try {
      await publish({
        ...argv,
        ...config
      });
    } catch (err) {
      log.error(err.message);
      process.exit(1);
    }
  }
});


// ----- Publish Guard ---------------------------------------------------------

cli.command({
  command: 'guard',
  config: {
    auto: false
  },
  description: 'Guards against accidental invocations of `npm publish`. This command should be run as a "prepublishOnly" script.',
  handler: () => {
    try {
      publishGuard();
    } catch (err) {
      log.error(err.message);
      config.set('isPublishing', false);
      process.exit(1);
    }
  }
});


cli.init(argv => {
  argv.wrap(128);
});
