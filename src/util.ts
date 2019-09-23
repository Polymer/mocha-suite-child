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

export function inherit(target: Object, source: Object): void {
  const targetPropertyNames = allPropertyNames(target);
  for (const propertyName of allPropertyNames(source)) {
    if (!targetPropertyNames.includes(propertyName)) {
      // @ts-ignore - It says that
      target[propertyName] = source[propertyName];
    }
  }
}

function allPropertyNames(object: Object): string[] {
  const propertyNames = Object.getOwnPropertyNames(object);
  const prototype = Object.getPrototypeOf(object);
  if (prototype) {
    propertyNames.push.apply(propertyNames, allPropertyNames(prototype));
  }
  return propertyNames;
}
