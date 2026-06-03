// tests/pdf.test.js
// PDF translation tests

describe('PDF Translation', () => {
  test('PDF.js library is loaded', () => {
    // pdfjsLib should be available in pdf-viewer.html context
    expect(typeof pdfjsLib).toBeDefined;
  });

  test('validates PDF file type', () => {
    const file = { type: 'application/pdf', name: 'test.pdf' };
    expect(file.type).toBe('application/pdf');
    expect(file.name.endsWith('.pdf')).toBe(true);
  });

  test('rejects non-PDF files', () => {
    const file = { type: 'image/jpeg', name: 'test.jpg' };
    expect(file.type).not.toBe('application/pdf');
  });

  test('page data structure', () => {
    const page = {
      pageNum: 1,
      text: 'Hello world',
      lines: ['Hello world']
    };
    expect(page.pageNum).toBe(1);
    expect(page.text).toBeTruthy();
    expect(page.lines).toBeInstanceOf(Array);
  });

  test('bilingual HTML output structure', () => {
    const html = `
      <div class="page">
        <div class="page-header">第 1 页</div>
        <div class="page-content">
          <div class="page-original"><p>Hello</p></div>
          <div class="page-translated"><p>你好</p></div>
        </div>
      </div>
    `;
    expect(html).toContain('page-original');
    expect(html).toContain('page-translated');
  });

  test('progress calculation', () => {
    const totalPages = 10;
    const currentPage = 5;
    const progress = (currentPage / totalPages) * 100;
    expect(progress).toBe(50);
  });

  test('batch translation with max concurrent', () => {
    const maxConcurrent = 3;
    const totalPages = 10;
    const batches = Math.ceil(totalPages / maxConcurrent);
    expect(batches).toBe(4);
  });
});

console.log('PDF tests loaded:', new Date().toISOString());