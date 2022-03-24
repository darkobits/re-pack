import { createRequire } from 'module';
import { nr } from '@darkobits/ts';

const require = createRequire(import.meta.url);

export default nr(({ createCommand, createScript }) => {
  try {
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
  } catch {
    // Project hasn't been built yet.
  }
});
