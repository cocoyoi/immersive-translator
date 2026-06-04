// site-patches.js - immersive-translator
// Site-specific DOM optimizations for major websites
// Applied before translation to ensure clean, accurate content extraction

(function() {
  'use strict';

  const SitePatches = {
    // Registry: hostname pattern -> patch function
    patches: {},

    register(hostnamePattern, patchFn) {
      this.patches[hostnamePattern] = patchFn;
    },

    apply(hostname = window.location.hostname) {
      for (const [pattern, patchFn] of Object.entries(this.patches)) {
        if (hostname.includes(pattern)) {
          try {
            patchFn();
          } catch (e) {
            console.warn(`[immersive-translator] Site patch failed for ${pattern}:`, e);
          }
        }
      }
    }
  };

  // === Google Search ===
  SitePatches.register('google.com', () => {
    // Remove knowledge panels, ads, "People also ask" from translation
    const noise = document.querySelectorAll(
      '.knowledge-panel, .commercial-unit, .ULSxyf, .g-blk[data-ved], #bres, #brs, .related-question-pair'
    );
    noise.forEach(el => el.setAttribute('data-it-skip', 'true'));
  });

  // === X / Twitter ===
  SitePatches.register('twitter.com', () => {
    const noise = document.querySelectorAll(
      '[data-testid="primaryColumn"] > div > div:first-child, ' +
      '[data-testid="sidebarColumn"], ' +
      '[data-testid="tweetButtonInline"], ' +
      '.r-1uhd6vh'
    );
    noise.forEach(el => el.setAttribute('data-it-skip', 'true'));
  });
  SitePatches.register('x.com', () => {
    const noise = document.querySelectorAll(
      '[data-testid="primaryColumn"] > div > div:first-child, ' +
      '[data-testid="sidebarColumn"], ' +
      '[data-testid="tweetButtonInline"]'
    );
    noise.forEach(el => el.setAttribute('data-it-skip', 'true'));
  });

  // === Reddit ===
  SitePatches.register('reddit.com', () => {
    // Mark sidebars, ads, "More posts" sections as skip
    const noise = document.querySelectorAll(
      '.CommentTree, .promotedlink, .sidebar, .ad-banner, ' +
      '[data-testid="frontpage-sidebar"], [data-testid="subreddit-sidebar"]'
    );
    noise.forEach(el => el.setAttribute('data-it-skip', 'true'));
  });

  // === YouTube ===
  SitePatches.register('youtube.com', () => {
    // Skip comments, sidebar recommendations
    const noise = document.querySelectorAll(
      '#comments, #related, ytd-watch-next-secondary-results-renderer, ' +
      '.ytd-comments-header-renderer, #masthead-ad'
    );
    noise.forEach(el => el.setAttribute('data-it-skip', 'true'));
  });

  // === GitHub ===
  SitePatches.register('github.com', () => {
    // Focus on README and markdown, skip file trees, issues sidebar
    const noise = document.querySelectorAll(
      '.repository-content > .clearfix > div:first-child, ' + // file tree sidebar
      '.Layout-sidebar, .js-discussion-sidebar, ' +
      '.border-top.color-border-muted.pt-3' // issue metadata
    );
    noise.forEach(el => el.setAttribute('data-it-skip', 'true'));
    // Boost README visibility
    document.querySelectorAll('.markdown-body, .readme').forEach(el => {
      el.setAttribute('data-it-boost', 'true');
    });
  });

  // === Stack Overflow ===
  SitePatches.register('stackoverflow.com', () => {
    const noise = document.querySelectorAll(
      '.js-sidebar-zone, .s-sidebarwidget, .bottom-notice, ' +
      '#hot-network-questions, .bsub, .everyonelovesstackoverflow'
    );
    noise.forEach(el => el.setAttribute('data-it-skip', 'true'));
  });

  // === Medium ===
  SitePatches.register('medium.com', () => {
    // Medium's article structure is clean, just skip header/footer
    const noise = document.querySelectorAll(
      'nav, header, .js-stickyFooter, .u-paddingTop10'
    );
    noise.forEach(el => el.setAttribute('data-it-skip', 'true'));
  });

  // === Wikipedia ===
  SitePatches.register('wikipedia.org', () => {
    // Skip infobox, toc, references, sidebar nav
    const noise = document.querySelectorAll(
      '.infobox, .toc, .reflist, .navbox, .external, ' +
      '.mw-parser-output > table, .catlinks, #mw-panel'
    );
    noise.forEach(el => el.setAttribute('data-it-skip', 'true'));
    // Boost main content
    document.querySelectorAll('#mw-content-text .mw-parser-output').forEach(el => {
      el.setAttribute('data-it-boost', 'true');
    });
  });

  // === Hacker News ===
  SitePatches.register('news.ycombinator.com', () => {
    // HN is table-based, mark noise rows
    const rows = document.querySelectorAll('tr');
    rows.forEach(row => {
      const text = row.innerText.trim();
      if (text.includes('Guidelines') || text.includes('FAQ') || text.includes('Lists') || text.includes('Security')) {
        row.setAttribute('data-it-skip', 'true');
      }
    });
  });

  // === Generic: apply skip attribute to common noise elements ===
  SitePatches.register('*', () => {
    const genericNoise = document.querySelectorAll(
      '[class*="cookie"], [class*="gdpr"], [class*="consent"], ' +
      '[class*="newsletter"], [class*="subscribe"], [class*="promo"], ' +
      '[id*="cookie"], [id*="gdpr"], [id*="consent"], ' +
      'nav, header, footer, aside, [role="banner"], [role="contentinfo"]'
    );
    genericNoise.forEach(el => {
      if (!el.getAttribute('data-it-boost')) {
        el.setAttribute('data-it-skip', 'true');
      }
    });
  });

  if (typeof window !== 'undefined') {
    window.SitePatches = SitePatches;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SitePatches;
  }
})();