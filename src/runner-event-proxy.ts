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

const {
  EVENT_RUN_BEGIN,
  EVENT_RUN_END,
} =
    // @ts-ignore this exists, but not in the typings
    Mocha.Runner.constants;

type ProxyEvent = [string, Mocha.Runner, string, unknown[]];

// `RunnerEventProxy` instances inherit methods from `Mocha.Runner` for the
// `EventEmitter` functionality.
export interface RunnerEventProxy {
  total: typeof Mocha.Runner.prototype.total;
  emit: typeof Mocha.Runner.prototype.emit;
}

export class RunnerEventProxy {
  total: number = 0;
  url?: string;
  private eventBuffer: ProxyEvent[] = [];
  private currentRunner?: Mocha.Runner;

  listen(runner: Mocha.Runner, url: string) {
    this.total = this.total + runner.total;
    for (const eventNameKey of Object.keys(
             // @ts-ignore
             Mocha.Runner.constants)) {
      const eventName =
          // @ts-ignore
          Mocha.Runner.constants[eventNameKey];
      runner.on(
          eventName,
          (a?: unknown, b?: unknown, c?: unknown, d?: unknown, e?: unknown) =>
              this.proxyEvent(eventName, runner, url, [a, b, c, d, e]));
    }
  }

  private flushEventBuffer() {
    const events = this.eventBuffer;
    this.eventBuffer = [];
    for (const event of events) {
      this.proxyEvent.apply(this, event);
    }
  }

  private proxyEvent(
      eventName: string, runner: Mocha.Runner, url: string, extra: unknown[]) {
    if (this.currentRunner && this.currentRunner !== runner) {
      this.eventBuffer.push([eventName, runner, url, extra]);
      return;
    }

    if (eventName === EVENT_RUN_BEGIN) {
      this.currentRunner = runner;
      if (this.url === url) {
        // We can emit this once.
        this.emit(EVENT_RUN_BEGIN);
      }
    } else if (eventName === EVENT_RUN_END) {
      this.currentRunner = undefined;
      this.flushEventBuffer();
      // If any children are still running, we can't emit the run end event yet.
      for (const instance of window.MochaSuiteChild.instances.values()) {
        if (instance.running) {
          return;
        }
      }
      // If the event buffer is not empty after we've flushed it, we can't emit
      // the run end event yet.
      if (this.eventBuffer.length > 0) {
        return;
      }
      this.emit(EVENT_RUN_END);
    } else {
      this.emit(eventName, extra[0], extra[1], extra[2], extra[3], extra[4]);
    }
  }
}

inherit(
    RunnerEventProxy.prototype, Object.getPrototypeOf(Mocha.Runner.prototype));
