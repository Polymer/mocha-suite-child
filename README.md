# mocha-suite-child (of mine)

Intended for use when running mocha in web-browsers, runs mocha test suites defined in HTML documents and include the results as if they are part of the main context.

An example `.html` file using `mocha-suite-child` package to include 3 child suites in its run:

```html
<script src="./node_modules/mocha/mocha.js"></script>
<!-- Load mocha-suite-child right after you mocha for best results. -->
<script src="./node_modules/mocha-suite-child/mocha-suite-child.js"></script>
<script src="./node_modules/chai/chai.js"></script>
<script>
  // Typical mocha setup bit.
  mocha.setup('tdd');

  // Defines the children of the current mocha context.  Note that
  // the same test suite files can be reused as children, with different
  // configurations. These must be defined at the top-level, i.e.
  // they can't be nested within Mocha's own `suite()` declarations.
  suiteChild('Juggling apples', './juggle.html?obj=apples');
  suiteChild('Juggling chainsaws', './juggle.html?obj=chainsaws');
  suiteChild('Bicycling tests', './bicycling.html');
  
  // You can still have local tests defined here if you want.
  suite('A regular test suite', () => {
    test('A regular test', () => {
      chai.assert(true);
    });
  });
  
  // Returns a MochaSuiteChild.RunnerProxy if child suites are defined.
  // This is because the child suites *must* execute before the local
  // runner executes in order to satisfy the reporter's expectation
  // of accurate test totals. This RunnerProxy should work identically 
  // to a Mocha.Runner for all intents and purposes.
  mocha.run();
</script>
```

