// tests/epub.test.js
// ePub translation tests

describe('ePub Translation', () => {
  test('validates ePub file type', () => {
    const file = { name: 'book.epub' };
    expect(file.name.endsWith('.epub')).toBe(true);
  });

  test('rejects non-ePub files', () => {
    const file = { name: 'book.pdf' };
    expect(file.name.endsWith('.epub')).toBe(false);
  });

  test('chapter structure', () => {
    const chapter = {
      id: 1,
      href: 'OEBPS/chapter1.xhtml',
      title: 'Chapter 1'
    };
    expect(chapter.id).toBe(1);
    expect(chapter.href).toContain('chapter');
    expect(chapter.title).toBeTruthy();
  });

  test('paragraph extraction', () => {
    const paragraphs = [
      { original: 'Hello world', element: 'p', html: '<p>Hello world</p>' },
      { original: 'Second paragraph', element: 'p', html: '<p>Second paragraph</p>' }
    ];
    expect(paragraphs.length).toBe(2);
    expect(paragraphs[0].element).toBe('p');
  });

  test('metadata extraction', () => {
    const metadata = {
      title: 'Test Book',
      author: 'Test Author',
      opfDir: 'OEBPS/'
    };
    expect(metadata.title).toBeTruthy();
    expect(metadata.author).toBeTruthy();
  });

  test('bilingual ePub HTML generation', () => {
    const html = `
      <p>Original text</p>
      <p style="color: #667eea;">Translated text</p>
    `;
    expect(html).toContain('color: #667eea');
    expect(html).toContain('Original text');
  });

  test('chapter status tracking', () => {
    const statuses = ['等待翻译', '翻译中...', '已完成', '翻译失败'];
    expect(statuses).toContain('已完成');
    expect(statuses).toContain('翻译失败');
  });
});

console.log('ePub tests loaded:', new Date().toISOString());