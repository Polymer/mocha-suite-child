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

import {MochaRunnerEvents, RunnerEventProxy} from './runner-event-proxy';
import {createStatsCollector} from './stats-collector';

/**
 * Wraps the`run` method of a Mocha instance to run suite children and proxy
 * their events up to the current reporter, by having the reporter listen to the
 * proxy instead of the current runner.
 */
export const patchMocha = (mocha: typeof window.mocha) => {
  const originalRun = mocha.run.bind(mocha);

  mocha.run = (fn?: (failures: number) => void) => {
    const originalReporter = window.mocha['_reporter'];
    const instance = window.MochaSuiteChild.instance;
    const proxy = window.MochaSuiteChild.runnerEventProxy =
        new RunnerEventProxy();

    // If you don't call this function that attaches the stats objects to the
    // runner instance, Mocha will just silently fail as it attempts to
    // increment stats on the events like EVENT_TEST_PASS etc and then you
    // will tear out your hair looking for why it isn't working for two days.
    createStatsCollector(proxy as unknown as Mocha.Runner);

    /**
     * The API of `Mocha#reporter` is that it be given a constructor function
     * that will `new` up an instance of a Reporter.  We already have a reporter
     * instance, so our constructor will just be a function that hooks it up to
     * the provided runner.
     * @param runner
     * @param options
     */
    function PseudoReporterConstructor(
        runner: Mocha.Runner, options: Mocha.MochaOptions) {
      proxy.url = window.location.href;
      proxy.listen(runner, proxy.url);
      if (instance) {
        runner.on(
            MochaRunnerEvents.EVENT_RUN_END,
            () => runInstances.then(() => instance.done()));
        window.MochaSuiteChild.parentScope!.runnerEventProxy!.listen(
            proxy as unknown as Mocha.Runner, proxy.url);
      }
      runner.on(
          MochaRunnerEvents.EVENT_RUN_END,
          () => runInstances.then(() => proxy.done()));
      new originalReporter(proxy, options);
    }

    window.mocha.reporter(
        PseudoReporterConstructor as unknown as Mocha.ReporterConstructor);

    const runInstances = window.MochaSuiteChild.runInstances();
    return originalRun(fn);
  };
}
