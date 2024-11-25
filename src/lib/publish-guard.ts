import config from 'lib/config'
import log from 'lib/log'

/**
 * Checks that a publish is being performed by re-pack and not a naked
 * `npm publish`, which can lead to breaking changes for users.
 */
export default function publishGuard() {
  const isPublishing = config.get('isPublishing') as boolean

  if (isPublishing) {
    log.verbose(log.prefix('guard'), 'Okay to publish!')
  } else {
    throw new Error(`${log.prefix('guard')} This package should be published using "re-pack publish".`)
  }
}