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

import {Controller} from './controller';
import {MochaRunnerEvents, RunnerProxy} from './runner-proxy';

/**
 * Defines and manages the execution of an external HTML document containing a
 * separate Mocha test suite, which happens in an IFrame.
 */
export class SuiteChild {
  connected: boolean = false;
  label: string;
  running: boolean = false;
  url: string;

  private controller: Controller;
  private iframe: HTMLIFrameElement;
  private runnerProxy?: RunnerProxy;
  private timeoutId?: number;

  constructor(controller: Controller, labelOrURL: string, url?: string) {
    this.controller = controller;
    this.label = labelOrURL;
    if (typeof url === 'undefined') {
      url = labelOrURL;
    }
    this.iframe = document.createElement('iframe');

    // We need to ensure that relative URLs are represented explicitly with
    // leading `./` or they'll be interpreted as absolute when we set the `src`
    // of the IFrame.
    this.iframe.src =
        !(url.match(/^[\.\/]/) || url.match(/:/)) ? `./${url}` : url;

    // The IFrame expands the URL, so we'll adopt the expanded version.
    this.url = this.iframe.src;
  }

  /**
   * Called from the child iframe and given the runner proxy from that context.
   * We do this so that the local context's runner proxy is able to listen to
   * the runner proxy's events and obtain its registered total number of tests
   * for the reporter.
   */
  notifyConnected(runnerProxy: RunnerProxy) {
    this.connected = true;
    this.runnerProxy = runnerProxy;
    this.controller.runnerProxy.listen(runnerProxy, this.url, this);
    this.controller.notifySuiteChildConnected(this);
    this.runnerProxy.on(MochaRunnerEvents.EVENT_RUN_END, () => this.done());
  }

  /**
   * Appends the IFrame for the test suite to the container element which
   * initiates the loading the document at the location specified by the
   * IFrame's src attribute.  When that document has loaded and its `mocha.run`
   * has been called, this `SuiteChild` instance will be notified by having its
   * `notifyConnected` method called by the child IFrame, with its runner proxy.
   */
  run(container: HTMLElement, loadTimeout: number) {
    this.running = true;

    // TODO(usergenic): Test this.
    // If this is a repeat execution of the suite child, we may need to remove
    // it from the DOM before re-appending it.
    if (this.iframe.parentElement === container) {
      this.iframe.removeChild(this.iframe);
    }
    container.appendChild(this.iframe);
    this.timeoutId = window.setTimeout(
        () => this.done(new Error(`Timed out loading "${this.url}"`)),
        loadTimeout);
  }

  private done(error?: Error) {
    this.running = false;
    clearTimeout(this.timeoutId);
    if (error) {
      throw error;
    }
  }
}
