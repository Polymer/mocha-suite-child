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
import {RunnerEventProxy} from './runner-event-proxy';

export class MochaSuiteChild {
  static loadTimeout: number = 60_000;

  // MochaSuiteChild instances of the current window.
  public static instances: Map<string, MochaSuiteChild> = new Map();
  public static runnerEventProxy?: RunnerEventProxy;

  static suiteChild(labelOrURL: string, url?: string): MochaSuiteChild {
    return new MochaSuiteChild(labelOrURL, url);
  }

  static instancesRunning: boolean = false;

  static get instance(): MochaSuiteChild|undefined {
    return this.parentScope ?
        this.parentScope.instances.get(window.location.href) :
        undefined;
  }

  static get parentScope(): typeof MochaSuiteChild|undefined {
    return window.parent && window.parent !== window ?
        window.parent.MochaSuiteChild :
        undefined;
  }

  static runInstances(done?: (err?: Error) => void): void {
    const instanceCount = this.instances.size;
    let completionCount = 0;
    this.instancesRunning = true;
    for (const instance of this.instances.values()) {
      instance.run((err?: Error) => {
        ++completionCount;
        if (completionCount >= instanceCount) {
          this.instancesRunning = false;
          done && done(err);
        }
      });
    }
  }

  running: boolean = false;
  runner?: Mocha.Runner;
  total: number = 0;

  readonly label: string;
  readonly url: string;

  private _iframe?: HTMLIFrameElement;
  private container?: HTMLElement;
  private timeoutId?: number;
  private _done?: (err?: Error) => void;

  constructor(labelOrURL: string, url?: string) {
    this.label = labelOrURL;
    if (!url) {
      url = labelOrURL;
    }

    // The IFrame expands the URL, so we'll take the expanded version.
    this.iframe.src =
        !(url.match(/^[\.\/]/) || url.match(/:/)) ? `./${url}` : url;

    // TODO(usergenic): Should we get the Mocha-specific params like GREP for
    // the current window and propagate them down to our MochaSuiteChild
    // iframes?  Have a look at
    // https://github.com/Polymer/tools/blob/master/packages/wct-mocha/src/childrunner.ts#L46
    this.url = this.iframe.src;
    window.MochaSuiteChild.instances.set(this.url, this);
  }

  done(err?: Error) {
    this.running = false;
    clearTimeout(this.timeoutId);
    if (this._iframe) {
      this.removeIFrame();
    }
    if (this._done) {
      this._done(err);
    }
  }

  run(done?: (err?: Error) => void) {
    this.running = true;
    this._done = done;

    this.findOrCreateContainer().appendChild(this.iframe);

    this.timeoutId = window.setTimeout(
        () => this.done &&
            this.done(new Error(`Timed out loading "${this.url}"`)),
        MochaSuiteChild.loadTimeout);
  }

  private findOrCreateContainer() {
    if (this.container) {
      return this.container;
    }
    let container =
        document.getElementById('mocha-suite-children') as HTMLElement;
    if (!container) {
      container = document.createElement('div');
      container.id = 'mocha-suite-children';
      container.style.display = 'none';
      document.body.appendChild(container);
    }
    this.container = container;
    return container;
  }

  private get iframe(): HTMLIFrameElement {
    if (!this._iframe) {
      this._iframe = document.createElement('iframe');
      if (this.url) {
        this._iframe.src = this.url;
      }
    }
    return this._iframe;
  }

  private removeIFrame(): void {
    /*
    if (this._iframe) {
      const iframe = this._iframe;
      setTimeout(() => {
        if (this.container) {
          this.container.removeChild(iframe);
        }
      }, 1);
    }
    */
  }
}
