import config from 'lib/config'
import log from 'lib/log'

/**
 * Checks that a publish is being performed by re-pack and not a naked
 * `npm publish`, which can lead to breaking changes for users.
 */
export default function publishGuard() {
  const isPublishing = config.get('isPublishing') as boolean
  const prefix = log.chalk.cyan.dim('guard')

  if (isPublishing) {
    log.verbose(prefix, 'Okay to publish!')
  } else {
    throw new Error(`${prefix} This package should be published using "re-pack publish".`)
  }
}