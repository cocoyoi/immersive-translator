// tests/setup.js
// Jest setup file - polyfills for browser APIs in Node.js

global.TextEncoder = require('util').TextEncoder;
global.TextDecoder = require('util').TextDecoder;
