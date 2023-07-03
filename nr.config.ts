import { nr } from '@darkobits/ts';

export default nr(({ command, script }) => {
  script('test.smoke', [
    command.node('./dist/bin/cli.js')
    // command('smoke-test-publish', ['node'
    //   [require.resolve('./dist/bin/cli.js'),  'publish'], { dryRun: true}
    // ], {})
  ], {
    group: 'Testing',
    description: 'Runs smoke tests.',
    timing: true
  });

  script('postBuild', [
    'script:test.smoke'
  ], {
    group: 'Lifecycle'
  });
});
