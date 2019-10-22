mocha.setup('tdd');

suiteChild('The Top-Suite', '/base/test/top-suite.html');
test('oh hai thar', () => {
  return true;
});
