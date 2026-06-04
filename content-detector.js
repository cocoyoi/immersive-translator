// content-detector.js - immersive-translator
// Smart main-content area detection for bilingual translation
// Heuristic-based approach inspired by Readability / Mozilla

(function() {
  'use strict';

  const ContentDetector = {
    // Tags that are unlikely to be main content
    UNLIKELY_TAGS: new Set(['SCRIPT', 'STYLE', 'NAV', 'HEADER', 'FOOTER', 'ASIDE', 'FORM', 'BUTTON', 'INPUT', 'IFRAME', 'CANVAS', 'SVG', 'VIDEO', 'AUDIO']),
    
    // Tags that are likely to contain content
    CONTENT_TAGS: new Set(['ARTICLE', 'MAIN', 'SECTION', 'DIV', 'P', 'BLOCKQUOTE', 'LI', 'TD']),

    // Selectors for known site content areas (high-confidence)
    SITE_CONTENT_SELECTORS: {
      // News & Blogs
      'medium.com': 'article',
      'substack.com': '.postArticle',
      'wordpress.com': '.entry-content, .post-content',
      'blogger.com': '.post-body, .entry-content',
      
      // Tech
      'github.com': '.readme, .markdown-body, [data-testid="readme"]',
      'stackoverflow.com': '.s-prose, .post-text',
      'docs.microsoft.com': '.content, .markdown-section',
      'developer.mozilla.org': 'article',
      
      // Social
      'twitter.com': 'article[data-testid="tweet"]',
      'x.com': 'article[data-testid="tweet"]',
      'reddit.com': '.md, [data-testid="comment"]',
      
      // News
      'nytimes.com': 'article[data-testid="article"]',
      'washingtonpost.com': '.article-body',
      'bbc.com': '[data-component="text-block"]',
      'economist.com': '.article__body',
      
      // General fallback
      'default': 'article, .article, .post, .entry, .content, .main, main, #content, #main, .post-content, .entry-content, .article-body, .markdown-body'
    },

    // Common classes/ids that indicate non-content
    UNLIKELY_PATTERNS: [
      /navbar|nav-bar|nav_menu|navigation|menu/i,
      /sidebar|side-bar|widget|recent-posts|popular/i,
      /comment|respond|disqus|fb-comments/i,
      /footer|copyright|advertisement|ad-|ads-|sponsor/i,
      /related|recommend|trending|popular|more-stories/i,
      /breadcrumb|share|social|follow|subscribe/i,
      /cookie|consent|gdpr|privacy|terms/i,
      /banner|promo|newsletter|signup|login/i,
      /header|masthead|site-title|logo/i
    ],

    scoreNode(node) {
      if (!node || node.nodeType !== Node.ELEMENT_NODE) return 0;
      const tag = node.tagName;
      
      // Skip unlikely tags entirely
      if (this.UNLIKELY_TAGS.has(tag)) return -100;
      
      let score = 0;
      const classId = (node.className || '') + ' ' + (node.id || '');
      
      // Check against unlikely patterns
      for (const pattern of this.UNLIKELY_PATTERNS) {
        if (pattern.test(classId)) score -= 25;
      }
      
      // Tag bonuses
      if (tag === 'ARTICLE') score += 50;
      if (tag === 'MAIN') score += 40;
      if (tag === 'SECTION') score += 15;
      
      // Content density
      const textLength = node.innerText?.length || 0;
      const linkDensity = this.getLinkDensity(node);
      
      // High text content is good
      if (textLength > 200) score += 20;
      if (textLength > 1000) score += 30;
      if (textLength > 5000) score += 20;
      
      // Low link density is good (content area, not nav)
      if (linkDensity < 0.1) score += 25;
      if (linkDensity > 0.5) score -= 30;
      
      // Paragraph count
      const pCount = node.querySelectorAll('p').length;
      score += pCount * 3;
      
      // Image/video penalty (media-heavy areas are often galleries, not articles)
      const imgCount = node.querySelectorAll('img').length;
      const iframeCount = node.querySelectorAll('iframe').length;
      if (imgCount > pCount * 2) score -= 15;
      if (iframeCount > 0) score -= 10;
      
      // Class/ID bonuses for known content markers
      if (/content|article|post|entry|body|text|story/i.test(classId)) score += 15;
      if (/main|primary|wrapper|container/i.test(classId)) score += 5;
      
      return score;
    },

    getLinkDensity(node) {
      const textLength = node.innerText?.length || 1;
      const linkText = Array.from(node.querySelectorAll('a'))
        .reduce((sum, a) => sum + (a.innerText?.length || 0), 0);
      return linkText / textLength;
    },

    getSiteSelector(hostname) {
      for (const [domain, selector] of Object.entries(this.SITE_CONTENT_SELECTORS)) {
        if (hostname.includes(domain)) return selector;
      }
      return this.SITE_CONTENT_SELECTORS.default;
    },

    detect(hostname = window.location.hostname) {
      // 1. Try site-specific selector first (high confidence)
      const siteSelector = this.getSiteSelector(hostname);
      if (siteSelector !== this.SITE_CONTENT_SELECTORS.default) {
        const el = document.querySelector(siteSelector);
        if (el && el.innerText.length > 200) {
          return { element: el, method: 'site-specific', confidence: 'high' };
        }
      }
      
      // 2. Try known content selectors
      const knownEls = document.querySelectorAll(siteSelector);
      let bestEl = null;
      let bestScore = -Infinity;
      
      for (const el of knownEls) {
        const score = this.scoreNode(el);
        if (score > bestScore && el.innerText.length > 200) {
          bestScore = score;
          bestEl = el;
        }
      }
      
      if (bestEl && bestScore > 30) {
        return { element: bestEl, method: 'selector', confidence: bestScore > 60 ? 'high' : 'medium' };
      }
      
      // 3. Score all candidate containers
      const candidates = document.querySelectorAll('article, main, section, div, [role="main"]');
      bestEl = null;
      bestScore = -Infinity;
      
      for (const el of candidates) {
        const score = this.scoreNode(el);
        if (score > bestScore && el.innerText.length > 200) {
          bestScore = score;
          bestEl = el;
        }
      }
      
      if (bestEl && bestScore > 20) {
        return { element: bestEl, method: 'heuristic', confidence: bestScore > 50 ? 'medium' : 'low' };
      }
      
      // 4. Ultimate fallback: body
      return { element: document.body, method: 'fallback', confidence: 'low' };
    },

    // Extract text blocks from a content area for paragraph-level translation
    extractTextBlocks(rootElement) {
      const blocks = [];
      const walker = document.createTreeWalker(
        rootElement,
        NodeFilter.SHOW_ELEMENT,
        {
          acceptNode(node) {
            if (['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'TD', 'TH', 'BLOCKQUOTE', 'PRE'].includes(node.tagName)) {
              return NodeFilter.FILTER_ACCEPT;
            }
            return NodeFilter.FILTER_SKIP;
          }
        }
      );
      
      let node;
      while ((node = walker.nextNode())) {
        const text = node.innerText?.trim();
        if (text && text.length > 10 && !node.closest('nav, header, footer, aside, .comment, [class*="comment"]')) {
          blocks.push({ element: node, text, tag: node.tagName });
        }
      }
      return blocks;
    },

    // Check if a node is inside a known non-content area
    isInNonContentArea(node) {
      const nonContentSelectors = [
        'nav', 'header', 'footer', 'aside', '[role="navigation"]',
        '[role="complementary"]', '.sidebar', '.widget', '.comment',
        '#comments', '.advertisement', '.ad-container'
      ];
      return nonContentSelectors.some(sel => node.closest(sel));
    }
  };

  if (typeof window !== 'undefined') {
    window.ContentDetector = ContentDetector;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ContentDetector;
  }
})();
