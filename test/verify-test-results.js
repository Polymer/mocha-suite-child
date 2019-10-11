const getStream = require('get-stream');
const chai = require('chai');

const expectedTestResults = `
  The Top-Suite
    oh hai
      ✓ local test
    Child Suite 1 with query "a"
      suite child 1
        ✓ test 1 in suite child 1
        ✓ test 2 in suite child 1
    Child Suite 1 with query "b"
      suite child 1
        ✓ test 1 in suite child 1
        ✓ test 2 in suite child 1
    Child Suite 2
      suite child 2
        ✓ test 1 in suite child 2
        ✓ test 2 in suite child 2
`;

const expectedTestResultsRegExp = new RegExp(expectedTestResults, 'um');

getStream(process.stdin).then((actualTestResults) => {
  console.log('Test Results:\n', actualTestResults);

  try {
    chai.expect(actualTestResults)
        .to.include(
            `  The Top-Suite\n    oh hai\n      ✓ local test`,
            `Should include top suite tests first.`);
    chai.expect(actualTestResults)
        .to.include(
            `    Child Suite 1 with query "a"\n` +
            `      suite child 1\n` +
            `        ✓ test 1 in suite child 1\n` +
            `        ✓ test 2 in suite child 1\n`);
    chai.expect(actualTestResults)
        .to.include(
            `    Child Suite 1 with query "b"\n` +
            `      suite child 1\n` +
            `        ✓ test 1 in suite child 1\n` +
            `        ✓ test 2 in suite child 1\n`);
    chai.expect(actualTestResults)
        .to.include(
            `    Child Suite 2\n` +
            `      suite child 2\n` +
            `        ✓ test 1 in suite child 2\n` +
            `        ✓ test 2 in suite child 2\n`);
    chai.expect(actualTestResults)
        .to.include(
            'Executed 7 of 7 SUCCESS', 'Should include correct "of 7" totals');
    chai.expect(actualTestResults)
        .to.include('TOTAL: 7 SUCCESS', 'Should report total passing tests');
  } catch (e) {
    console.log(e);
    process.exit(1);
  }

  console.log('Matched expected test results!');
  process.exit(0);
});
