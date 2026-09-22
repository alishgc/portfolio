/* ============================================
   BLOG.JS
   - Theme toggle: click handler + persistence.
     The actual first-paint theme is set by a tiny
     inline script in <head> (see _layouts/default.html)
     so there's no flash of the wrong theme.
   - Share buttons: native share sheet where available,
     falls back to copy-link.
============================================ */
(function () {
  var root = document.documentElement;
  var KEY = 'blog-theme';

  function currentTheme() {
    return root.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  }

  function setTheme(theme) {
    root.setAttribute('data-theme', theme);
    try { localStorage.setItem(KEY, theme); } catch (e) {}
  }

  document.addEventListener('DOMContentLoaded', function () {
    // --- Theme toggle buttons ---
    var toggles = document.querySelectorAll('[data-theme-toggle]');
    toggles.forEach(function (btn) {
      btn.addEventListener('click', function () {
        setTheme(currentTheme() === 'dark' ? 'light' : 'dark');
      });
    });

    // --- Share buttons ---
    var shareButtons = document.querySelectorAll('[data-share]');
    shareButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var url = btn.getAttribute('data-share-url') || window.location.href;
        var title = btn.getAttribute('data-share-title') || document.title;

        if (navigator.share) {
          navigator.share({ title: title, url: url }).catch(function () {});
          return;
        }

        var label = btn.querySelector('.share-btn__label');
        var restore = label ? label.textContent : btn.textContent;

        function showCopied() {
          if (label) { label.textContent = 'Copied!'; }
          else { btn.textContent = 'Copied!'; }
          btn.classList.add('is-copied');
          setTimeout(function () {
            if (label) { label.textContent = restore; }
            else { btn.textContent = restore; }
            btn.classList.remove('is-copied');
          }, 1600);
        }

        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(showCopied).catch(function () {});
        } else {
          var tmp = document.createElement('textarea');
          tmp.value = url;
          document.body.appendChild(tmp);
          tmp.select();
          try { document.execCommand('copy'); showCopied(); } catch (e) {}
          document.body.removeChild(tmp);
        }
      });
    });
  });
})();
