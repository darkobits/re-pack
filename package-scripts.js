module.exports = require('@darkobits/ts').nps(() => ({
  scripts: {
    repack: {
      script: 're-pack',
      watch: {
        script: 're-pack --watch --link'
      }
    },
    publish: {
      script: 're-pack --publish'
    }
  }
}));
