import { defineConfig } from '@darkobits/nr'
import { defaultPackageScripts } from '@darkobits/ts'

export default defineConfig([
  defaultPackageScripts,
  ({ command, script }) => {
    script('test.smoke', command.node('./dist/bin/cli.js'), {
      group: 'Testing',
      description: 'Run smoke tests.',
      timing: true
    })

    script('postBuild', 'script:test.smoke', { group: 'Lifecycle' })
  }
])