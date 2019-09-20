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
import {RunnerEventProxy} from './runner-event-proxy';

export const patchMocha = (mocha: typeof window.mocha) => {
  const originalRun = mocha.run.bind(mocha);

  mocha.run = (fn?: (failures: number) => void) => {
    const originalReporter = window.mocha['_reporter'];
    const instance =
        window.MochaSuiteChild.root.instances.get(window.location.href);
    function PseudoReporterConstructor(
        runner: Mocha.Runner, options: Mocha.MochaOptions) {
      if (instance) {
        instance.setRunner(runner);
        window.MochaSuiteChild.root.runnerEventProxy!.listen(runner);
        new originalReporter(runner, options);
      } else {
        const proxy = window.MochaSuiteChild.root.runnerEventProxy =
            new RunnerEventProxy();
        proxy.listen(runner);
        new originalReporter(proxy, options);
      }
    }
    window.mocha.reporter(
        PseudoReporterConstructor as unknown as Mocha.ReporterConstructor);

    // If we are the top-level (i.e. there is no `instance` of a MochaSuiteChild
    // running for this window) then we must
    if (!instance) {
      for (const instance of window.MochaSuiteChild.root.instances.values()) {
        instance.run();
      }
    }
    return originalRun(fn);
  };
}
