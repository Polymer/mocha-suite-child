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

export async function runChildren(
    urls: string[], reporterProxy: ReporterProxy, _options: unknown):
    Promise<void[]> {
  const childRunners: ChildRunner[] = urls.map((url) => new ChildRunner(url));
  for (const childRunner of childRunners) {
    reporterProxy.listen(childRunner as unknown as Mocha.IRunner);
  }
  return Promise.all(childRunners.map((runner) => runner.run()));
};

export function suiteChild(url: string) {
  suiteChildURLs.push(url);
}

const suiteChildURLs: string[] = [];

declare global {
  interface Window {
    mocha: Mocha;
    Mocha: typeof Mocha;
    suiteChild: typeof suiteChild;
  }
}

window.suiteChild = suiteChild;

const originalMochaRun = window.mocha.run;
window.mocha.run = (fn?: (failures: number) => void) => {
  const originalReporter = window.mocha['_reporter'];
  const reporterProxy = new ReporterProxy([originalReporter], {});
  createStatsCollector(reporterProxy as any);
  function reporterConstructor(
      runner: Mocha.IRunner, _options: unknown): Mocha.Reporter {
    reporterProxy.listen(runner);
    return reporterProxy as unknown as Mocha.Reporter;
  };
  window.mocha.reporter(reporterConstructor as any);
  runChildren(suiteChildURLs, reporterProxy, mocha.options);
  return originalMochaRun(fn);
};
