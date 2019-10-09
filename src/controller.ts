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
import {RunnerProxy} from './runner-proxy';
import {SuiteChild} from './suite-child';

export const CONTAINER_ID = 'mocha-suite-child-container';

export type DoneCallback = (error?: Error) => void;

export class Controller {
  children = new Map<string, SuiteChild>();
  loadTimeout = 60_000;

  private _container?: HTMLElement;
  private _callback?: DoneCallback;

  get container(): HTMLElement {
    if (!this._container) {
      let container = document.getElementById(CONTAINER_ID) as HTMLElement;
      if (!container) {
        container = document.createElement('div');
        container.id = CONTAINER_ID;
        container.style.display = 'none';
        document.body.appendChild(container);
      }
      this._container = container;
    }
    return this._container;
  }

  get parent(): Controller|undefined {
    return window.parent && window.parent !== window ?
        window.parent.MochaSuiteChild :
        undefined;
  }

  suiteChild(labelOrURL: string, url?: string) {
    const suiteChild = new SuiteChild(this, labelOrURL, url);
    this.children.set(suiteChild.url, suiteChild);
  }

  done(error?: Error) {
    if (this._callback) {
      this._callback(error);
    }
  }

  run(callback?: DoneCallback) {
    this._callback = callback;
  }

  notifySuiteChildDone(_child: SuiteChild, _error?: Error) {
    // TODO(usergenic): store the error so we can report on all errors in suite
    // children.

    let allDone = true;
    for (const child of this.children.values()) {
      if (child.running) {
        allDone = false;
      }
    }
    if (allDone) {
      this.done();
    }
  }
}
