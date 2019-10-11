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

import {Runner, Suite} from 'mocha';

import {createStatsCollector} from './stats-collector';
import {SuiteChild} from './suite-child';
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
  name: string;
  runner: Runner;
  url: string;
  suiteChild?: SuiteChild;
  extra: unknown[];
}

interface EmitEvent {
  name: string;
  extra: unknown[];
}

export class RunnerProxy implements Mocha.Runner {
  total = 0
  stats!: Mocha.Stats;
  emitQueue: EmitEvent[] = [];
  processingQueue: ProxyEvent[] = [];
  currentRunner?: Runner;
  private localRunner?: Runner;
  private runBeginEmitted: boolean = false;
  private runEndCount = 0;
  private runnerCount = 0;
  private rootSuite: Suite;

  constructor() {
    // Important: If you don't call this function that attaches the stats
    // objects to the runner instance, Mocha will just silently fail as it
    // attempts to increment stats on the events like EVENT_TEST_PASS etc and
    // then you will tear out your hair looking for why it isn't working.
    createStatsCollector(this as unknown as Runner);
    this.rootSuite = new Suite('');
    this.rootSuite.root = true;
  }

  /**
   * Listens for all relevant events emitted by the runner.
   */
  listen(runner: Mocha.Runner, url: string, suiteChild?: SuiteChild) {
    if (runner instanceof Mocha.Runner) {
      this.localRunner = runner;
    }
    ++this.runnerCount;
    this.total = this.total + runner.total;
    for (const name of Object.values(MochaRunnerEvents)) {
      runner.on(
          name,
          (...extra) =>
              this.processEvent({name, url, runner, suiteChild, extra}));
    }
  }

  private flushEmitQueue() {
    const events = this.emitQueue;
    this.emitQueue = [];
    for (const event of events) {
      if (window.location.href.match(/top-suite/)) {
        console.log('EMITTING', event.name, ...event.extra);
      }
      this.emit(event.name, ...event.extra);
    }
  }

  private flushProcessingQueue() {
    const events = this.processingQueue;
    this.processingQueue = [];
    for (const event of events) {
      this.processEvent(event);
    }
  }

  private processEvent(event: ProxyEvent) {
    // TODO(usergenic): We might be able to make an optimization to this method
    // whereby we can flush the emitQueue after the final runner's root
    // suite start event has come in.  We would need to explicitly track which
    // runners have emitted root suite begin events of course.

    // If we are currently processing events for a different runner, we will
    // just put this event into the process queue and handle it later.
    if (this.currentRunner && this.currentRunner !== event.runner) {
      this.processingQueue.push(event);
      return;
    }

    // If we haven't put any events into the emit queue yet, it is because we
    // haven't started processing events for the local runner yet.  We need to
    // process those first so they report first.
    if (this.emitQueue.length === 0 && this.localRunner !== event.runner) {
      this.processingQueue.push(event);
      return;
    }

    if (event.name === MochaRunnerEvents.EVENT_RUN_BEGIN) {
      this.currentRunner = event.runner;
      if (!this.runBeginEmitted) {
        this.runBeginEmitted = true;

        // Emit the run begin event immediately to signal to the reporter that
        // it's on.  This should help avoid any timeouts related to waiting for
        // first event.  Everything else must move to the emit queue, however,
        // because the root suite *has* to have a reference to all sub-suites
        // and those can only reliably known once all runners have reported all
        // of their root suite begin events.
        this.emit(event.name);

        this.emitQueue.push({
          name: MochaRunnerEvents.EVENT_SUITE_BEGIN,
          extra: [this.rootSuite]
        });
      }
      return;
    }

    if (event.name === MochaRunnerEvents.EVENT_RUN_END) {
      this.currentRunner = undefined;
      ++this.runEndCount;

      if (this.processingQueue.length > 0) {
        this.flushProcessingQueue();
        return;
      }

      // We can emit the run end event only when we have started listening to
      // the local mocha runner and have heard run end events from all runners
      // we are listening to.
      if (this.localRunner && this.runEndCount === this.runnerCount) {
        this.emitQueue.push(
            {name: MochaRunnerEvents.EVENT_SUITE_END, extra: [this.rootSuite]});
        this.emitQueue.push(event);
        this.flushEmitQueue();
      }

      return;
    }

    // Lets use the label to prepend the child's suite title if we are running
    // in a suite child context.
    if (event.name === MochaRunnerEvents.EVENT_SUITE_BEGIN) {
      const suite = event.extra[0] as unknown as Suite;
      if (suite.root) {
        // If the event has no suiteChild, then this is a root suite from the
        // local runner, and we want to steal its children and put them in our
        // merged synthetic `this.rootSuite`. have `this.rootSuite`.
        if (!event.suiteChild) {
          for (const childSuite of suite.suites) {
            this.rootSuite.suites.push(childSuite);
            childSuite.parent = this.rootSuite;
          }
          return;
        }

        // Otherwise, lets make this suite child's root suite a child of
        // `this.rootSuite`, give it a title and remove it's "root" status.
        this.rootSuite.suites.push(suite);
        suite.title = event.suiteChild.label;
        suite.root = false;
        suite.parent = this.rootSuite;
      }
    }

    // Lets use the label to prepend the child's suite title if we are running
    // in a suite child context.
    if (event.name === MochaRunnerEvents.EVENT_SUITE_END) {
      const suite = event.extra[0] as unknown as Suite;
      // If the suite is a root suite, we can discard it, since the only root
      // suite we need to emit and end event for is `this.rootSuite` right
      // before the run end event.  This root suite is the one from the local
      // runner for which we've already discarded the run begin event.
      if (suite.root) {
        return;
      }
    }

    // Lets just proxy that event.
    this.emitQueue.push(event);
  }
}

// `RunnerEventProxy` instances inherit methods and properties of
// `Mocha.Runner` for the `EventEmitter` functionality.
inherit(RunnerProxy.prototype, Object.getPrototypeOf(Runner.prototype));
export interface RunnerProxy extends Mocha.Runner {}
