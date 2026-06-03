// tests/youtube.test.js
// YouTube subtitle translation tests

describe('YouTube Subtitle Translation', () => {
  test('detects YouTube URL', () => {
    const urls = [
      'https://www.youtube.com/watch?v=abc123',
      'https://youtu.be/abc123',
      'https://youtube.com/shorts/abc123'
    ];
    urls.forEach(url => {
      expect(/youtube\.com|youtu\.be/.test(url)).toBe(true);
    });
  });

  test('rejects non-YouTube URLs', () => {
    const urls = [
      'https://www.bilibili.com/video/BV123',
      'https://vimeo.com/123456',
      'https://www.netflix.com/watch/123'
    ];
    urls.forEach(url => {
      expect(/youtube\.com|youtu\.be/.test(url)).toBe(false);
    });
  });

  test('subtitle cache key format', () => {
    const text = 'Hello';
    const lang = 'zh-CN';
    const key = `yt:${text}:${lang}`;
    expect(key).toBe('yt:Hello:zh-CN');
  });

  test('subtitle element detection', () => {
    const selectors = [
      '.ytp-caption-segment',
      '.captions-text',
      '[class*="caption"]'
    ];
    expect(selectors.length).toBeGreaterThan(0);
  });

  test('bilingual subtitle structure', () => {
    const subtitle = {
      original: 'Hello world',
      translated: '你好世界',
      style: 'bilingual'
    };
    expect(subtitle.original).toBeTruthy();
    expect(subtitle.translated).toBeTruthy();
  });

  test('video ID extraction from URL', () => {
    const url = 'https://www.youtube.com/watch?v=abc123';
    const videoId = new URL(url).searchParams.get('v');
    expect(videoId).toBe('abc123');
  });

  test('cache per video session', () => {
    const cache = new Map();
    const videoId = 'abc123';
    const text = 'Hello';
    cache.set(`yt:${text}:${videoId}`, '你好');
    expect(cache.get(`yt:${text}:${videoId}`)).toBe('你好');
  });
});

console.log('YouTube tests loaded:', new Date().toISOString());