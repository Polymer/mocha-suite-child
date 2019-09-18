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
import {ChildRunner} from './child-runner';
import {ReporterProxy} from './reporter-proxy';
import {createStatsCollector} from './stats-collector';

declare global {
  interface Window {
    mocha: Mocha;
    Mocha: typeof Mocha;
    suiteChild: (typeof suiteChild)&{
      reporterProxy?: ReporterProxy,
      childRunners?: Map<string, ChildRunner>,
    };
  }
}

window.suiteChild = suiteChild;
window.suiteChild.childRunners = new Map<string, ChildRunner>();
const originalMochaRun = window.mocha.run.bind(window.mocha);

export function suiteChild(url: string) {
  const childRunner = new ChildRunner(url);
  window.suiteChild.childRunners!.set(childRunner.url, childRunner);
}

window.mocha.run = (fn?: (failures: number) => void) => {
  const originalReporter = window.mocha['_reporter'];

  const parentSuiteChild =
      window.parent !== window && window.parent && window.parent.suiteChild;

  let reporterProxy: ReporterProxy|undefined = undefined;
  let childRunner: ChildRunner|undefined = undefined;

  if (parentSuiteChild) {
    reporterProxy = parentSuiteChild.reporterProxy!;
    childRunner = parentSuiteChild.childRunners!.get(window.location.href)!;
  }

  if (!reporterProxy) {
    reporterProxy = window.suiteChild.reporterProxy =
        new ReporterProxy([originalReporter], {});
    // TODO(usergenic): Figure out if needed; this seems cargo-culty
    createStatsCollector(reporterProxy as any);
  }

  function reporterConstructor(
      runner: Mocha.IRunner, _options: unknown): Mocha.Reporter {
    console.log('i am making reporter proxy listen to', runner);
    reporterProxy!.listen(runner);
    // @ts-ignore
    this.done = true;
    return reporterProxy as unknown as Mocha.Reporter;
  };

  window.mocha.reporter(reporterConstructor as any);

  const childRunnersPromise = Promise.all(
      [...window.suiteChild.childRunners!.values()].map((runner) => {
        reporterProxy!.listen(runner as unknown as Mocha.Runner);
        return runner.run();
      }));

  return originalMochaRun((failures: number) => {
    console.log('oh hai!');
    childRunnersPromise.then(() => {
      reporterProxy!.done();
      console.log(
          'Super Done!',
          window.location.href,
          [...window.suiteChild.childRunners!.keys()]);
      if (fn) {
        fn(failures);
      }
    });

    if (childRunner) {
      console.log('I reported my childRunner.done()');
      childRunner.done();
    }
  });
};
