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

import {SuiteChild} from './suite-child';
import {inherit} from './util';

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

export class RunnerProxy implements Runner {
  total = 0
  stats:
      Mocha.Stats = {suites: 0, tests: 0, passes: 0, pending: 0, failures: 0};
  emitQueue: EmitEvent[] = [];
  processingQueue: ProxyEvent[] = [];
  currentRunner?: Runner;
  private localRunner?: Runner;
  private runBeginEmitted: boolean = false;
  private runEndCount = 0;
  private runnerCount = 0;
  private rootSuite: Suite;

  constructor() {
    this.on(
        Runner.constants.EVENT_RUN_BEGIN, () => this.stats.start = new Date());
    this.on(
        Runner.constants.EVENT_SUITE_BEGIN,
        (suite) => suite.root || ++this.stats.suites);
    this.on(Runner.constants.EVENT_TEST_PASS, () => ++this.stats.passes);
    this.on(Runner.constants.EVENT_TEST_FAIL, () => ++this.stats.failures);
    this.on(Runner.constants.EVENT_TEST_PENDING, () => ++this.stats.pending);
    this.on(Runner.constants.EVENT_TEST_END, () => ++this.stats.tests);
    this.on(Runner.constants.EVENT_RUN_END, () => {
      this.stats.end = new Date();
      this.stats.duration = +this.stats.end - +this.stats.start!;
    });
    this.rootSuite = new Suite('');
    this.rootSuite.root = true;
  }

  /**
   * Listens for all relevant events emitted by the runner.
   */
  listen(runner: Runner, url: string, suiteChild?: SuiteChild) {
    if (runner instanceof Runner) {
      this.localRunner = runner;
    }
    ++this.runnerCount;
    this.total = this.total + runner.total;
    for (const key in Runner.constants) {
      // `Runner.constants` may have a null prototype, built as it is from
      // Mocha utils' `createMap` function, so `hasOwnProperty` may be
      // unavailable on it directly.  Therefore, we use `Object.prototype`
      // explicitly to obtain `hasOwnProperty()` to test for the property.
      // Further, we are only interested in the `EVENT_*` named constants.
      if (/^EVENT_/.test(key) &&
          Object.prototype.hasOwnProperty.call(Runner.constants, key)) {
        const name = Runner.constants[key] as string;
        runner.on(
            name,
            (...extra) =>
                this.processEvent({name, url, runner, suiteChild, extra}));
      }
    }
  }

  private flushEmitQueue() {
    const events = this.emitQueue;
    this.emitQueue = [];
    for (const event of events) {
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

    if (event.name === Runner.constants.EVENT_RUN_BEGIN) {
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
          name: Runner.constants.EVENT_SUITE_BEGIN,
          extra: [this.rootSuite]
        });
      }
      return;
    }

    if (event.name === Runner.constants.EVENT_RUN_END) {
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
            {name: Runner.constants.EVENT_SUITE_END, extra: [this.rootSuite]});
        this.emitQueue.push(event);
        this.flushEmitQueue();
      }

      return;
    }

    // Lets use the label to prepend the child's suite title if we are running
    // in a suite child context.
    if (event.name === Runner.constants.EVENT_SUITE_BEGIN) {
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
    if (event.name === Runner.constants.EVENT_SUITE_END) {
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
export interface RunnerProxy extends Runner {}
