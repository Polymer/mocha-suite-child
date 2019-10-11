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

import {Runner} from 'mocha';

import {createStatsCollector} from './stats-collector';
import {inherit} from './util';

export const MochaRunnerEvents = {
  /**
   * Emitted when {@link Hook} execution begins
   */
  EVENT_HOOK_BEGIN: 'hook',
  /**
   * Emitted when {@link Hook} execution ends
   */
  EVENT_HOOK_END: 'hook end',
  /**
   * Emitted when Root {@link Suite} execution begins (all files have been
   * parsed and hooks/tests are ready for execution)
   */
  EVENT_RUN_BEGIN: 'start',
  /**
   * Emitted when Root {@link Suite} execution has been delayed via `delay`
   * option
   */
  EVENT_DELAY_BEGIN: 'waiting',
  /**
   * Emitted when delayed Root {@link Suite} execution is triggered by user via
   * `global.run()`
   */
  EVENT_DELAY_END: 'ready',
  /**
   * Emitted when Root {@link Suite} execution ends
   */
  EVENT_RUN_END: 'end',
  /**
   * Emitted when {@link Suite} execution begins
   */
  EVENT_SUITE_BEGIN: 'suite',
  /**
   * Emitted when {@link Suite} execution ends
   */
  EVENT_SUITE_END: 'suite end',
  /**
   * Emitted when {@link Test} execution begins
   */
  EVENT_TEST_BEGIN: 'test',
  /**
   * Emitted when {@link Test} execution ends
   */
  EVENT_TEST_END: 'test end',
  /**
   * Emitted when {@link Test} execution fails
   */
  EVENT_TEST_FAIL: 'fail',
  /**
   * Emitted when {@link Test} execution succeeds
   */
  EVENT_TEST_PASS: 'pass',
  /**
   * Emitted when {@link Test} becomes pending
   */
  EVENT_TEST_PENDING: 'pending',
  /**
   * Emitted when {@link Test} execution has failed, but will retry
   */
  EVENT_TEST_RETRY: 'retry'
}

interface ProxyEvent {
  name: string, runner: Runner, url: string, extra: unknown[],
}

export class RunnerProxy implements Mocha.Runner {
  eventBuffer: ProxyEvent[] = [];
  currentRunner?: Runner;
  private localRunner?: Runner;
  private runBeginEmitted: boolean = false;
  private runEndCount = 0;
  private runnerCount = 0;

  constructor() {
    // Important: If you don't call this function that attaches the stats
    // objects to the runner instance, Mocha will just silently fail as it
    // attempts to increment stats on the events like EVENT_TEST_PASS etc and
    // then you will tear out your hair looking for why it isn't working.
    createStatsCollector(this as unknown as Runner);
  }

  /**
   * Listens for all relevant events emitted by the runner.
   */
  listen(runner: Mocha.Runner, url: string) {
    if (runner instanceof Mocha.Runner) {
      this.localRunner = runner;
    }
    this.total = this.total + runner.total;
    for (const name of Object.values(MochaRunnerEvents)) {
      runner.on(
          name, (...extra) => this.proxyEvent({name, url, runner, extra}));
    }
  }

  private proxyEvent(event: ProxyEvent) {
    // If we are currently processing events for a different runner, we will
    // just put this event into the buffer.
    if (this.currentRunner && this.currentRunner !== event.runner) {
      this.eventBuffer.push(event);
      return;
    }

    if (event.name === MochaRunnerEvents.EVENT_RUN_BEGIN) {
      this.currentRunner = event.runner;
      if (!this.runBeginEmitted) {
        this.runBeginEmitted = true;
        this.emit(MochaRunnerEvents.EVENT_RUN_BEGIN);
      }
      return;
    }

    if (event.name === MochaRunnerEvents.EVENT_RUN_END) {
      ++this.runEndCount;

      // We can emit the run end event only when we have started listening to
      // the local mocha runner and have heard run end events from all runners
      // we are listening to.
      if (this.localRunner && this.runEndCount === this.runnerCount) {
        this.emit(MochaRunnerEvents.EVENT_RUN_END);
        return;
      }
    }

    // Lets use the label to prepend the child's suite title if we are running
    // in a suite child context.
    if (event.name === MochaRunnerEvents.EVENT_SUITE_BEGIN) {
      const {suiteChildOfMine} = window.MochaSuiteChild;
      if (suiteChildOfMine) {
        const suite = event.extra[0] as unknown as Mocha.Suite;
        suite.title = `${suiteChildOfMine.label} ${suite.title}`;
      }
    }

    // Lets just proxy that event.
    this.emit(event.name, ...event.extra);
  }
}

// `RunnerEventProxy` instances inherit methods and properties of
// `Mocha.Runner` for the `EventEmitter` functionality.
inherit(RunnerProxy.prototype, Object.getPrototypeOf(Runner.prototype));
export interface RunnerProxy extends Mocha.Runner {}
