# mocha-suite-child

Intended for use when running mocha in web-browsers, runs mocha test suites defined in HTML documents and include the results as if they are part of the main context.

# Example

Include `mocha` and `mocha-suite-child` libraries in all participating HTML files and always include mocha-sub *after* mocha because it patches code that is defined by mocha.

```html
<script src="./node_modules/mocha/mocha.js"></script>
<script src="./node_modules/mocha-suite-child/mocha-suite-child.js"></script>
<script>
  suiteChild('./config-tests.html?config=1');
  suiteChild('./config-tests.html?config=2');
  suiteChild('./other-tests.html');

  suite('a regular test suite', () => {
    test('a regular test', () => {
      assert(true);
    });
  });
</script>
```
