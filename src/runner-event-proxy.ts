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
import {inherit} from './util';

export const MochaRunnerEvents: {[key: string]: string} = {
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

type ProxyEvent = [string, Mocha.Runner, string, unknown[]];

// `RunnerEventProxy` instances inherit methods from `Mocha.Runner` for the
// `EventEmitter` functionality.
export interface RunnerEventProxy {
  total: typeof Mocha.Runner.prototype.total;
  emit: typeof Mocha.Runner.prototype.emit;
}

export class RunnerEventProxy {
  total: number = 0;
  stats?: Mocha.Stats;
  url?: string;
  private eventBuffer: ProxyEvent[] = [];
  private currentRunner?: Mocha.Runner;

  done() {
    this.proxyEvent(
        MochaRunnerEvents.EVENT_RUN_END, this.currentRunner!, this.url!, []);
  }

  listen(runner: Mocha.Runner, url: string) {
    this.total = this.total + runner.stats!.tests;
    console.log(`listening ${url} to ${this.total}`);
    console.log(runner);
    for (const eventNameKey of Object.keys(MochaRunnerEvents)) {
      const eventName: string = MochaRunnerEvents[eventNameKey];
      runner.on(
          eventName,
          (a?: unknown, b?: unknown, c?: unknown, d?: unknown, e?: unknown) =>
              this.proxyEvent(eventName, runner, url, [a, b, c, d, e]));
    }
  }

  // private aggregateStats(stats: Mocha.Stats) {
  //   const myStats = this.stats!;
  //   myStats.suites = myStats.suites + stats.suites;
  //   myStats.tests = myStats.tests + stats.tests;
  //   myStats.passes = myStats.passes + stats.passes;
  //   myStats.pending = myStats.pending + stats.pending;
  //   myStats.failures = myStats.failures + stats.failures;
  // }

  private proxyEvent(
      eventName: string, runner: Mocha.Runner, url: string, extra: unknown[]) {
    if (this.currentRunner && this.currentRunner !== runner) {
      this.eventBuffer.push([eventName, runner, url, extra]);
      return;
    }

    if (eventName === MochaRunnerEvents.EVENT_RUN_BEGIN) {
      this.currentRunner = runner;
      if (this.url === url) {
        // We can emit this once.
        this.emit(MochaRunnerEvents.EVENT_RUN_BEGIN);
      }
    } else if (eventName === MochaRunnerEvents.EVENT_RUN_END) {
      this.currentRunner = undefined;
      this.flushEventBuffer();
      // If any children are still running, we can't emit the run end event yet.
      if (window.MochaSuiteChild.instancesRunning) {
        return;
      }
      // If the event buffer is not empty after we've flushed it, we can't emit
      // the run end event yet.
      if (this.eventBuffer.length > 0) {
        return;
      }
      this.emit(MochaRunnerEvents.EVENT_RUN_END);
    } else {
      this.emit(eventName, extra[0], extra[1], extra[2], extra[3], extra[4]);
    }
  }

  private flushEventBuffer() {
    const events = this.eventBuffer;
    this.eventBuffer = [];
    for (const event of events) {
      this.proxyEvent.apply(this, event);
    }
  }
}

inherit(
    RunnerEventProxy.prototype, Object.getPrototypeOf(Mocha.Runner.prototype));
