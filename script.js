document.addEventListener('DOMContentLoaded', () => {

  /* ===============================
     PRELOADER — multilingual greeting cycle
     Ends on Nepali, since that's home.
  =============================== */
  const greetings = ['Hello', 'Hallo', 'Bonjour', 'こんにちは', '你好', 'Hola', 'مرحبا', 'नमस्ते'];
  const preloader = document.getElementById('preloader');
  const word = document.getElementById('preloaderWord');
  const progress = document.getElementById('preloaderProgress');

  let i = 0;
  const stepTime = 190; // ms per word

  if (progress) {
    progress.style.transition = `width ${greetings.length * stepTime}ms linear`;
    requestAnimationFrame(() => { progress.style.width = '100%'; });
  }

  const cycle = setInterval(() => {
    i++;
    if (i < greetings.length) {
      if (word) word.textContent = greetings[i];
    } else {
      clearInterval(cycle);
      setTimeout(finishLoad, 300);
    }
  }, stepTime);

  function finishLoad(){
    if (preloader) preloader.classList.add('is-done');
    document.body.classList.remove('is-loading');
    startTypewriter();
  }

  // Fallback in case something blocks the interval
  window.addEventListener('load', () => {
    setTimeout(() => {
      if (preloader && !preloader.classList.contains('is-done')) finishLoad();
    }, 3500);
  });

  /* ===============================
     TYPEWRITER — types "Alish" next to the blinking cursor
  =============================== */
  function startTypewriter(){
    const target = document.getElementById('typeTarget');
    if (!target) return;
    const text = 'Alish';
    let n = 0;
    const type = setInterval(() => {
      target.textContent = text.slice(0, n + 1);
      n++;
      if (n === text.length) clearInterval(type);
    }, 100);
  }

  /* ===============================
     THEME TOGGLE — mirrors the blog's dark/light switch
  =============================== */
  const root = document.documentElement;
  const toggle = document.getElementById('themeToggle') || document.querySelector('[data-theme-toggle]');

  function currentTheme(){
    const explicit = root.getAttribute('data-theme');
    if (explicit === 'dark' || explicit === 'light') return explicit;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }

  if (toggle) {
    toggle.addEventListener('click', () => {
      const next = currentTheme() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('theme', next); } catch (e) {}
    });
  }

});