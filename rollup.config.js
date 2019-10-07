module.exports = {
  context: 'window',
  external: ['mocha'],
  input: 'lib/index.js',
  output: {
    file: 'mocha-suite-child.js',
    format: 'iife',
    globals: {
      mocha: 'Mocha',
      'ts-polyfill/lib/es2018-promise': 'Promise'
    },
    name: 'MochaSuiteChild'
  }
}
