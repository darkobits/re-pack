module.exports = require('@darkobits/ts/package-scripts')(({ npsUtils }) => ({
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
