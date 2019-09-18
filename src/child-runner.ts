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

import {inherit} from './util';

interface EventListenerDescriptor {
  listener: EventListenerOrEventListenerObject;
  target: EventTarget;
  type: string;
}

/**
 * The `ChildRunner` is responsible for setting up an iframe pointing to a
 * "child" document containing the `mocha` test suite(s).
 */
export class ChildRunner {
  readonly url: string;
  state: 'initialized'|'loading'|'loaded'|'finished';
  private iframe: HTMLIFrameElement;
  private container?: HTMLElement;
  private timeoutId?: number;
  private runResolve?: () => void;
  private runReject?: (error: Error) => void;
  private eventListeners: EventListenerDescriptor[] = [];

  static loadTimeout = 60_000;

  constructor(url: string) {
    this.iframe = document.createElement('iframe');
    this.iframe.src = url;
    // iframe will expand the `src`, so we'll use that version.
    this.url = this.iframe.src;
    this.state = 'initialized';
  }

  async run(loadTimeout: number = ChildRunner.loadTimeout): Promise<void> {
    this.state = 'loading';

    const runPromise = new Promise<void>((resolve, reject) => {
      this.runResolve = resolve;
      this.runReject = reject;
    });

    this.findOrCreateContainer().appendChild(this.iframe);

    this.timeoutId = window.setTimeout(
        () => this.loaded(new Error(`Timed out loading "${this.url}"`)),
        loadTimeout);

    this.iframe.addEventListener(
        'error',
        () => this.loaded(new Error(`Failed to load document "${this.url}"`)));

    if (this.iframe.contentWindow) {
      this.iframe.contentWindow.addEventListener(
          'DOMContentLoaded', this.loaded.bind(this, undefined));
    }

    return runPromise;
  }

  private clearTimeout() {
    if (typeof this.timeoutId === 'number') {
      clearTimeout(this.timeoutId);
      this.timeoutId = undefined;
    }
  }

  done(error?: Error) {
    this.clearTimeout();
    if (error) {
      if (this.runReject) {
        this.runReject(error);
      }
    }
    if (this.iframe) {
      setTimeout(() => {
        this.removeAllEventListeners();
        if (this.container) {
          this.container.removeChild(this.iframe);
        }
        // Replace iframe with a fresh one.
        this.iframe = document.createElement('iframe');
        this.iframe.src = this.url;
      }, 1);
    }
    this.runResolve!();
  }

  private findOrCreateContainer() {
    if (this.container) {
      return this.container;
    }
    let container = document.getElementById('mocha-sub') as HTMLElement;
    if (!container) {
      container = document.createElement('div');
      container.id = 'mocha-suite-child';
      document.body.appendChild(container);
    }
    this.container = container;
    return container;
  }

  private loaded(error?: Error) {
    if (error || !this.iframe.contentWindow) {
      this.done(error);
      return;
    }
    this.state = 'loaded';
  }

  private removeAllEventListeners() {
    for (const {target, type, listener} of this.eventListeners) {
      target.removeEventListener(type, listener);
    }
  }
}

// This is how we will obtain all the features from `Mocha.Runner`, especially
// the `EventEmitter` methods.
inherit(ChildRunner.prototype, Mocha.Runner.prototype);
