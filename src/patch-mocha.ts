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

import Mocha from 'mocha';

/**
 * Given the `window.mocha` object, wrap the `run` method to inject code to
 * initiate the child suite runs and wait for them to report initial totals
 * before executing the local mocha suite and connecting the reporter.  This is
 * necessary because the reporter expects the runner to report the total number
 * of tests at start time and the only way to know the totals of child suites is
 * to wait for them to report.
 */
export const patchMocha = (mocha: Mocha) => {
  const originalRun = mocha.run.bind(mocha);

  mocha.run = (callback: (fn: number) => any) => {
    const url = document.location.href;
    const originalReporter = mocha['_reporter'];
    const {runnerProxy, suiteChildOfMine} = window.MochaSuiteChild;

    window.mocha.reporter(
        PseudoReporterConstructor as unknown as Mocha.ReporterConstructor);

    // Run all child suites, wait for them to provide their runner proxies so
    // the local runner proxy can listen to them and obtain accurate test
    // totals.
    window.MochaSuiteChild.runChildren(() => {
      // Note: We are relying on the fact that the `originalRun` is
      originalRun(callback);

      // If we are running in an iframe created by a controller in the parent
      // window, then suiteChildOfMine will be the SuiteChild class that is
      // managing the iframe.
      if (suiteChildOfMine) {
        // Connect the local runner proxy to the SuiteChild in the parent window
        // that created the iframe the current context is running in.
        suiteChildOfMine.notifyConnected(runnerProxy);
      }
    });

    /**
     * The API of `Mocha#reporter` is that it be given a constructor function
     * that will `new` up an instance of a Reporter.  We already have a reporter
     * instance, so our constructor will just be a function that hooks it up to
     * the provided runner.
     */
    function PseudoReporterConstructor(
        runner: Mocha.Runner, options: Mocha.MochaOptions) {
      runnerProxy.listen(runner, url);
      new originalReporter(runnerProxy, options);
    }

    return runnerProxy;
  };
}
