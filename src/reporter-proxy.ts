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

export const MochaEventNames = [
  'start',
  'end',
  'suite',
  'suite end',
  'test',
  'test end',
  'hook',
  'hook end',
  'pass',
  'fail',
  'pending',
];

export interface MochaEventEmitter {
  emit: typeof Mocha.Runner.prototype.emit;
}

/**
 * Basically this is the type expression for a Reporter constructor.
 */
export interface ReporterFactory {
  new(runner: MochaEventEmitter, options: unknown): Mocha.Reporter;
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
    this.emit('start');
  }

  done() {
    this.flushEventBuffer();
    this.emit('end');
  }

  /**
   * This method delegates to the `EventEmitter` API that `Mocha.Runner`
   * inherits from:
   * https://nodejs.org/api/events.html#events_emitter_emit_eventname_args
   * @param eventName Name of event to emit.
   * @param extraArgs Extra data to emit for event.
   */
  emit(eventName: string, ...extra: unknown[]): boolean {
    return Mocha.Runner.prototype.emit.apply(this, [eventName, ...extra]);
  }

  /**
   * Listens for events from the given runner.
   * @param runner The Mocha Runner instance for which to listen for events.
   */
  listen(runner: Mocha.IRunner) {
    this.total = this.total + 1;
    for (const eventName of MochaEventNames) {
      runner.on(eventName, this.proxyEvent.bind(this, eventName, runner));
    }
  }

  /**
   * Delegates to the `Mocha.Runner#on` method inherited from the `EventEmitter`
   * API.
   * @param eventName The name of the event to listen for.
   * @param listener The handler function for the event.
   */
  on(eventName: string, listener: (...extra: unknown[]) => void) {
    Mocha.Runner.prototype.on.apply(this, [eventName, listener]);
  }

  /**
   * Delegates to the `Mocha.Runner#once` method inherited from the
   * `EventEmitter` API.
   * @param eventName The name of the event to listen for.
   * @param listener The handler function for the event.
   */
  once(eventName: string, listener: (...extra: unknown[]) => void) {
    Mocha.Runner.prototype.once.apply(this, [eventName, listener]);
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

    if (eventName === 'start') {
      this.currentRunner = runner;
      this.total = this.total - 1 + runner.total;
    } else if (eventName === 'end') {
      this.currentRunner = undefined;
      this.flushEventBuffer();
    } else {
      this.emit(eventName, ...extra);
    }
  }
}
