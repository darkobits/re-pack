module.exports = require('@darkobits/ts').nps(() => ({
  scripts: {
    repack: {
      script: './dist/bin/cli.js',
      watch: {
        script: './dist/bin/cli.js --watch --link'
      }
    }
  }
}));
