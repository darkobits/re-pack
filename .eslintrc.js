module.exports = {
  extends: [
    require.resolve('@darkobits/ts/eslint')
  ],
  rules: {
    'no-console': 'off',
    'require-atomic-updates': 'off',
    'unicorn/no-reduce': 'off'
  }
}
