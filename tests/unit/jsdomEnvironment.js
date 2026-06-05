/* eslint-disable no-undef -- CommonJS environment shim that runs in the Node realm (require/module + Node globals). */
const JSDOMEnvironment = require('jest-environment-jsdom').default;

/**
 * jsdom test environment that injects Node globals jsdom omits but that Chakra
 * UI v3 relies on (`structuredClone`, `TextEncoder`/`TextDecoder`). This module
 * runs in the main Node realm, so those identifiers are the real Node globals —
 * we copy them into the jsdom sandbox.
 */
module.exports = class FixedJSDOMEnvironment extends JSDOMEnvironment {
  constructor(config, context) {
    super(config, context);

    if (typeof this.global.structuredClone === 'undefined') {
      this.global.structuredClone = structuredClone;
    }
    if (typeof this.global.TextEncoder === 'undefined') {
      this.global.TextEncoder = TextEncoder;
      this.global.TextDecoder = TextDecoder;
    }
  }
};
