import { nr } from '@darkobits/ts';

export default nr(({ command, script }) => {
  try {
    script('smokeTests', {
      group: 'Testing',
      description: 'Runs smoke tests.',
      run: [
        command('smoke-test', ['node', [require.resolve('./dist/bin/cli.js')]], {}),
        // command('smoke-test-publish', ['node'
        //   [require.resolve('./dist/bin/cli.js'),  'publish'], { dryRun: true}
        // ], {})
      ]
    });
  } catch (err) {
    console.error('WTF', err);
    // Project hasn't been built yet.
  }
});
