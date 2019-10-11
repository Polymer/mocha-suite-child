/**
 * @license
 * Copyright (c) 2019 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */

const getStream = require('get-stream');
const chai = require('chai');

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
