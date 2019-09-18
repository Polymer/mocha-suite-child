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
import {inherit} from './util';

// @ts-ignore these exist but not in the typings
const {
  EVENT_RUN_BEGIN,
  EVENT_RUN_END,
  EVENT_TEST_FAIL,
  EVENT_TEST_PASS,
  EVENT_TEST_PENDING,
  EVENT_SUITE_BEGIN,
  EVENT_SUITE_END,
  EVENT_HOOK_BEGIN,
  EVENT_HOOK_END,
} =
    // @ts-ignore this exists, but not in the typings
    Mocha.Runner.constants;

export const ProxyEventNames = [
  EVENT_RUN_BEGIN,
  EVENT_RUN_END,
  EVENT_TEST_FAIL,
  EVENT_TEST_PASS,
  EVENT_TEST_PENDING,
  EVENT_SUITE_BEGIN,
  EVENT_SUITE_END,
  EVENT_HOOK_BEGIN,
  EVENT_HOOK_END,
];

/**
 * Basically this is the type expression for a Reporter constructor.
 */
export interface ReporterFactory {
  new(runner: unknown, options: unknown): Mocha.Reporter;
}

type ProxiedEvent = [string, Mocha.IRunner, ...unknown[]];

/**
 * A special form of reporter which sits between the actual reporters defined in
 * the the `mocha` config, listens for events emitted in parallel by multiple
 * runners, then re-emits them so they can be picked up by the intended
 * user-facing reporters, grouped by runner so events from different runners are
 * not interleaved.
 */
export class ReporterProxy {
  readonly reporters: ReadonlyArray<Mocha.Reporter>;
  total: number = 0;
  private eventBuffer: ProxiedEvent[] = [];
  private currentRunner?: Mocha.IRunner;

  constructor(reporters: ReporterFactory[], options: unknown) {
    this.reporters = reporters.map((reporter) => new reporter(this, options));
    // TODO(usergenic): Can I get this in a type definition since I copied it
    // over from Mocha.Runner.prototype?
    // @ts-ignore
    this.emit(EVENT_RUN_BEGIN);
  }

  done() {
    this.flushEventBuffer();
    // TODO(usergenic): Can I get this in a type definition since I copied it
    // over from Mocha.Runner.prototype?
    // @ts-ignore
    this.emit(EVENT_RUN_END);
  }

  /**
   * Listens for events from the given runner.
   * @param runner The Mocha Runner instance for which to listen for events.
   */
  listen(runner: Mocha.IRunner) {
    this.total = this.total + 1;
    for (const eventName of ProxyEventNames) {
      runner.on(eventName, this.proxyEvent.bind(this, eventName, runner));
    }
  }

  private flushEventBuffer() {
    const eventBuffer = this.eventBuffer;
    this.eventBuffer = [];
    for (const event of eventBuffer) {
      this.proxyEvent(...event);
    }
  }

  private proxyEvent(
      eventName: string, runner: Mocha.IRunner, ...extra: unknown[]) {
    if (this.currentRunner && this.currentRunner !== runner) {
      this.eventBuffer.push([eventName, runner, ...extra]);
      return;
    }

    console.log(
        'proxyEvent',
        eventName,
        (runner as unknown as ChildRunner).url,
        ...extra);

    if (eventName === EVENT_RUN_BEGIN) {
      this.currentRunner = runner;
      this.total = this.total - 1 + runner.total;
    } else if (eventName === EVENT_RUN_END) {
      this.currentRunner = undefined;
      this.flushEventBuffer();
    } else {
      // TODO(usergenic): Can I get this in a type definition since I copied it
      // over from Mocha.Runner.prototype?
      // @ts-ignore
      this.emit(eventName, ...extra);
    }
  }
}

// This is how we will obtain all the features from `Mocha.Runner`, especially
// the `EventEmitter` methods.
inherit(ReporterProxy.prototype, Mocha.Runner.prototype);
