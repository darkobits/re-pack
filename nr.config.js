import { nr } from '@darkobits/ts';

export default nr(({ createCommand, createScript }) => {
  createScript('smokeTests', {
    group: 'Testing',
    description: 'Runs smoke tests.',
    run: [
      createCommand('smoke-tests', [
        require.resolve('./dist/bin/cli.js')
      ], {}),
      createCommand('smoke-tests', [
        require.resolve('./dist/bin/cli.js'), ['publish'], { dryRun: true}
      ], {})
    ]
  });
});
