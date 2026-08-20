// public/js/anim.js
// Scroll-reveal + entrance animation helpers shared across all pages.
// Mark elements with class "reveal" (optional inline style="--d:120ms" for stagger).
// Re-scan after injecting dynamic HTML: Animate.scan(container)

(function () {
  const observer = typeof IntersectionObserver !== 'undefined'
    ? new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('in-view');
          observer.unobserve(entry.target);
        }
      }, { threshold: 0.1, rootMargin: '0px 0px -48px 0px' })
    : null;

  function scan(root) {
    const targets = (root || document).querySelectorAll('.reveal:not(.in-view)');
    if (!observer) {
      targets.forEach((el) => el.classList.add('in-view'));
      return;
    }
    targets.forEach((el) => observer.observe(el));
  }

  window.Animate = { scan };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => scan(document));
  } else {
    scan(document);
  }
})();