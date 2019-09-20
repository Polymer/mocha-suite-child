const builtins = require('rollup-plugin-node-builtins')

module.exports = {
  context: 'window',
  external: ['mocha'],
  input: 'lib/index.js',
  plugins: [
    builtins()
  ],
  output: {
    file: 'mocha-suite-child.js',
    format: 'iife',
    globals: {
      mocha: 'Mocha'
    },
    name: 'MochaSuiteChild'
  }
}
