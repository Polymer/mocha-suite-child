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
import {createStatsCollector} from './stats-collector';

export const patchMocha = (mocha: typeof window.mocha) => {
  const originalRun = mocha.run.bind(mocha);

  mocha.run = (fn?: (failures: number) => void) => {
    const originalReporter = window.mocha['_reporter'];
    const instance = window.MochaSuiteChild.instance;

    function PseudoReporterConstructor(
        runner: Mocha.Runner, options: Mocha.MochaOptions) {
      const proxy = window.MochaSuiteChild.runnerEventProxy =
          new RunnerEventProxy();
      createStatsCollector(proxy as unknown as Mocha.Runner);
      proxy.url = window.location.href;
      proxy.listen(runner, proxy.url);
      if (instance) {
        instance.setRunner(runner);
        window.MochaSuiteChild.parentScope!.runnerEventProxy!.listen(
            proxy as unknown as Mocha.Runner, proxy.url);
      }
      new originalReporter(proxy, options);
    }

    window.mocha.reporter(
        PseudoReporterConstructor as unknown as Mocha.ReporterConstructor);

    for (const instance of window.MochaSuiteChild.instances.values()) {
      instance.run();
    }

    return originalRun(fn);
  };
}
