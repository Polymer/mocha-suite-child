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

export class SuiteChild {
  label: string;
  url: string;
  running: boolean = false;

  private controller: Controller;
  private iframe: HTMLIFrameElement;
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
    // of the iframe.
    this.iframe.src =
        !(url.match(/^[\.\/]/) || url.match(/:/)) ? `./${url}` : url;

    // The IFrame expands the URL, so we'll adopt the expanded version.
    this.url = this.iframe.src;
  }

  done(error?: Error) {
    this.running = false;
    clearTimeout(this.timeoutId);
    setTimeout(() => this.controller.container.removeChild(this.iframe), 1);
    this.controller.notifySuiteChildDone(this, error);
  }

  run() {
    this.running = true;
    this.controller.container.appendChild(this.iframe);
    this.timeoutId = window.setTimeout(
        () => this.done(new Error(`Timed out loading "${this.url}"`)),
        this.controller.loadTimeout);
  }
}
