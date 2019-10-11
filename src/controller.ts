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

// import Mocha from 'mocha';
// import {RunnerProxy} from './runner-proxy';
import {RunnerProxy} from './runner-proxy';
import {SuiteChild} from './suite-child';

export const DEFAULT_CONTAINER_ID = 'mocha-suite-child-container';
export type ConnectedCallback = (error?: Error) => void;

/**
 * The `window.MochaSuiteChild` property is an instance of Controller.  Its
 * function is to be the global interface to register children via
 * `suiteChild()` and provide affordances for the runners in iframes to callback
 * and notify about their status.
 */
export class Controller {
  containerId = DEFAULT_CONTAINER_ID;
  loadTimeout = 60_000;
  children = new Map<string, SuiteChild>();
  runnerProxy: RunnerProxy = new RunnerProxy();

  private _container?: HTMLElement;
  private connectedCallback?: ConnectedCallback;

  /**
   * This is a lazy-loaded property which will either find or create a container
   * element to append the iframes for children.  If it creates the element, it
   * will set its style to not be displayed.  If an existing container element
   * is found, it will be up to the developer to manage style/display.
   */
  get container(): HTMLElement {
    if (!this._container) {
      let container = document.getElementById(this.containerId) as HTMLElement;
      if (!container) {
        container = document.createElement('div');
        container.id = this.containerId;
        container.style.display = 'none';
        document.body.appendChild(container);
      }
      this._container = container;
    }
    return this._container;
  }

  /**
   * Returns the parent controller, i.e. controller in the parent window.
   */
  get parent(): Controller|undefined {
    return window.parent && window.parent !== window ?
        window.parent.MochaSuiteChild :
        undefined;
  }

  /**
   * Returns the SuiteChild instance that created the iframe for the current
   * context.
   */
  get suiteChildOfMine(): SuiteChild|undefined {
    return this.parent && this.parent.children.get(document.location.href);
  }

  /**
   * Defer to console.log for now.  Maybe do something more configurable and
   * interesting later.
   */
  log(...msg: unknown[]) {
    console.log(window.location.href, ...msg);
  }

  /**
   * Registers a child of the current mocha suite.  Use an optional label to
   * describe the suite:
   *   `suiteChild('Apple juggling', '/test/juggling.html?object=apples')`
   * Or skip the label and just provide the URL:
   *   `suiteChild('/test/juggling.html?object=chainsaws')`
   */
  suiteChild(labelOrURL: string, url?: string) {
    this.log(`defined suiteChild ${labelOrURL}`);
    const suiteChild = new SuiteChild(this, labelOrURL, url);
    this.children.set(suiteChild.url, suiteChild);
  }

  /**
   * Initiate all suite children and run the callback after all iframes report
   * connected.
   */
  runChildren(connectedCallback: ConnectedCallback) {
    this.log(`runChildren()`);
    this.connectedCallback = connectedCallback;
    for (const child of this.children.values()) {
      child.run(this.container, this.loadTimeout);
    }
  }

  notifySuiteChildConnected(_child: SuiteChild) {
    this.log(`notifySuiteChildConnected ${_child.label}`);
    for (const child of this.children.values()) {
      if (!child.connected) {
        return;
      }
    }
    const {connectedCallback} = this;
    if (connectedCallback) {
      connectedCallback();
      this.connectedCallback = undefined;
    } else {
      throw new Error('notifySuiteChildConnected called out-of-sequence');
    }
  }
}
