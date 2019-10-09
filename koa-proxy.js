const Koa = require('koa');
const { nodeResolve } = require('koa-node-resolve');
const { esmTransform } = require('koa-esm-transform');
const mount = require('koa-mount');
const staticFiles = require('koa-static');
new Koa()
  .use(esmTransform())
  .use(mount('/base', new Koa().use(nodeResolve()).use(staticFiles('.'))))
  .listen(9000);
