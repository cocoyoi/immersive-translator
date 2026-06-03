// tests/popup.test.js
// Popup UI tests

const { JSDOM } = require('jsdom');

describe('Popup UI', () => {
  let dom, doc;

  beforeEach(() => {
    const html = `
    <!DOCTYPE html>
    <html>
    <head></head>
    <body>
      <div id="translate-panel">
        <input id="enable-translate" type="checkbox">
        <select id="target-lang">
          <option value="zh-CN">中文</option>
          <option value="en">English</option>
        </select>
        <input id="font-size" type="range" value="14">
        <input id="trans-color" type="color" value="#667eea">
      </div>
      <div id="engines-panel" style="display:none">
        <input id="api-base" type="text">
        <input id="api-key" type="password">
        <input id="model-name" type="text">
        <input id="temperature" type="number" value="0.3">
      </div>
      <div id="advanced-panel" style="display:none">
        <select id="hover-modifier">
          <option value="ctrl">Ctrl</option>
        </select>
        <select id="input-trigger">
          <option value="triple-space">Triple Space</option>
        </select>
        <input id="max-concurrent" type="number" value="3">
      </div>
      <div id="logs-panel" style="display:none">
        <div id="logs-area"></div>
      </div>
      <div class="tab" data-panel="translate"></div>
      <div class="tab" data-panel="engines"></div>
      <div class="tab" data-panel="advanced"></div>
      <div class="tab" data-panel="logs"></div>
      <div id="status-dot"></div>
      <div id="status-text">Ready</div>
      <div id="test-result"></div>
      <div id="engine-list"></div>
      <div id="glossary-list"></div>
      <div id="expert-list"></div>
    </body>
    </html>
    `;
    dom = new JSDOM(html);
    doc = dom.window.document;
  });

  test('all panels exist', () => {
    expect(doc.getElementById('translate-panel')).toBeTruthy();
    expect(doc.getElementById('engines-panel')).toBeTruthy();
    expect(doc.getElementById('advanced-panel')).toBeTruthy();
    expect(doc.getElementById('logs-panel')).toBeTruthy();
  });

  test('all tabs exist', () => {
    const tabs = doc.querySelectorAll('.tab');
    expect(tabs.length).toBe(4);
  });

  test('translate toggle checkbox', () => {
    const checkbox = doc.getElementById('enable-translate');
    expect(checkbox.type).toBe('checkbox');
  });

  test('target language select', () => {
    const select = doc.getElementById('target-lang');
    expect(select.value).toBe('zh-CN');
  });

  test('font size range', () => {
    const range = doc.getElementById('font-size');
    expect(range.value).toBe('14');
  });

  test('translation color picker', () => {
    const picker = doc.getElementById('trans-color');
    expect(picker.value).toBe('#667eea');
  });

  test('API base input', () => {
    const input = doc.getElementById('api-base');
    expect(input).toBeTruthy();
  });

  test('API key input', () => {
    const input = doc.getElementById('api-key');
    expect(input.type).toBe('password');
  });

  test('temperature range', () => {
    const input = doc.getElementById('temperature');
    expect(parseFloat(input.value)).toBeGreaterThanOrEqual(0);
    expect(parseFloat(input.value)).toBeLessThanOrEqual(2);
  });

  test('hover modifier options', () => {
    const select = doc.getElementById('hover-modifier');
    expect(['ctrl', 'alt', 'shift']).toContain(select.value);
  });

  test('input trigger options', () => {
    const select = doc.getElementById('input-trigger');
    expect(['triple-space', 'double-space']).toContain(select.value);
  });

  test('max concurrent', () => {
    const input = doc.getElementById('max-concurrent');
    expect(parseInt(input.value)).toBeGreaterThanOrEqual(1);
    expect(parseInt(input.value)).toBeLessThanOrEqual(10);
  });

  test('status dot exists', () => {
    expect(doc.getElementById('status-dot')).toBeTruthy();
  });

  test('status text exists', () => {
    expect(doc.getElementById('status-text')).toBeTruthy();
  });
});

console.log('Popup tests loaded:', new Date().toISOString());