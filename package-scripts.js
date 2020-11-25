module.exports = require('@darkobits/ts').nps(({ npsUtils }) => ({
  scripts: {
    smokeTest: npsUtils.series(
      './dist/bin/cli.js',
      './dist/bin/cli.js publish --dry-run'
    )
  }
}));
