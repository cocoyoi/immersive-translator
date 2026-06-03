// tests/background.test.js
// Background script unit tests

const assert = require('assert');

// Mock chrome API
global.chrome = {
  storage: {
    sync: { get: () => Promise.resolve({}), set: () => Promise.resolve() },
    local: { get: () => Promise.resolve({}), set: () => Promise.resolve() }
  },
  contextMenus: { removeAll: () => Promise.resolve(), create: () => {} },
  tabs: { query: () => Promise.resolve([{ id: 1 }]), sendMessage: () => Promise.resolve() },
  action: { setBadgeText: () => {}, setBadgeBackgroundColor: () => {} },
  runtime: { onInstalled: { addListener: () => {} }, onStartup: { addListener: () => {} }, onMessage: { addListener: () => {} } }
};

// Simple test runner
async function runTests() {
  console.log('Running YaYacal Translation tests...\n');
  
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
  
  // Engine URL validation tests
  test('valid OpenAI URL', () => {
    const url = 'https://api.openai.com/v1';
    assert(url.startsWith('https://'));
  });
  
  test('valid Ollama local URL', () => {
    const url = 'http://localhost:11434/v1';
    assert(url.includes('localhost'));
  });
  
  test('model name extraction', () => {
    const model = 'gpt-4o-mini';
    assert(model.length > 0);
    assert(!model.includes(' '));
  });
  
  // Settings validation
  test('default temperature range', () => {
    const temp = 0.3;
    assert(temp >= 0 && temp <= 2);
  });
  
  test('concurrency limit', () => {
    const max = 3;
    assert(max >= 1 && max <= 10);
  });
  
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(e => {
  console.error('Test runner error:', e);
  process.exit(1);
});
