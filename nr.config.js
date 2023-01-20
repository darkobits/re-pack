import { createRequire } from 'module';
import { nr } from '@darkobits/ts';

const require = createRequire(import.meta.url);

export default nr(({ command, script }) => {
  try {
    script('smokeTests', {
      group: 'Testing',
      description: 'Runs smoke tests.',
      run: [
        command('smoke-tests', [
          require.resolve('./dist/bin/cli.js')
        ], {}),
        command('smoke-tests', [
          require.resolve('./dist/bin/cli.js'), ['publish'], { dryRun: true}
        ], {})
      ]
    });
  } catch {
    // Project hasn't been built yet.
  }
});
