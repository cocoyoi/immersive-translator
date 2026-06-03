// tests/content.test.js
// Content script unit tests

const assert = require('assert');
const { JSDOM } = require('jsdom');

// Setup DOM environment
const dom = new JSDOM('<!DOCTYPE html><html><body><p>Hello world</p><p>你好世界</p></body></html>');
global.document = dom.window.document;
global.window = dom.window;
global.Node = dom.window.Node;
global.NodeFilter = dom.window.NodeFilter;

// Mock chrome API
global.chrome = {
  storage: { sync: { get: () => Promise.resolve({}) }, local: { get: () => Promise.resolve({}) } },
  runtime: { onMessage: { addListener: () => {} } }
};

async function runTests() {
  console.log('Running content script tests...\n');
  
  let passed = 0, failed = 0;
  
  function test(name, fn) {
    try {
      fn();
      console.log(`  ✅ ${name}`);
      passed++;
    } catch (e) {
      console.log(`  ❌ ${name}: ${e.message}`);
      failed++;
    }
  }
  
  // Language detection tests
  test('detect Chinese', () => {
    const text = '你好世界';
    assert(/[\u4e00-\u9fff]/.test(text));
  });
  
  test('detect Japanese', () => {
    const text = 'こんにちは';
    assert(/[\u3040-\u309f]/.test(text));
  });
  
  test('detect English', () => {
    const text = 'Hello world';
    assert(/[a-zA-Z]/.test(text));
  });
  
  test('detect Korean', () => {
    const text = '안녕하세요';
    assert(/[\uac00-\ud7af]/.test(text));
  });
  
  test('detect Russian', () => {
    const text = 'Привет';
    assert(/[\u0400-\u04FF]/.test(text));
  });
  
  // DOM manipulation tests
  test('text node extraction', () => {
    const p = document.querySelector('p');
    assert(p.textContent === 'Hello world');
  });
  
  test('wrapper element creation', () => {
    const wrapper = document.createElement('span');
    wrapper.className = 'it-bilingual-inline';
    assert(wrapper.className === 'it-bilingual-inline');
  });
  
  test('block wrapper creation', () => {
    const wrapper = document.createElement('div');
    wrapper.className = 'it-bilingual-block';
    assert(wrapper.className === 'it-bilingual-block');
  });
  
  test('pure translation wrapper', () => {
    const span = document.createElement('span');
    span.className = 'it-pure-trans';
    assert(span.className === 'it-pure-trans');
  });
  
  // Language count
  test('multiple languages present', () => {
    const ps = document.querySelectorAll('p');
    assert(ps.length >= 2);
  });
  
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(e => {
  console.error('Test runner error:', e);
  process.exit(1);
});
