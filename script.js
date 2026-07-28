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

  progress.style.transition = `width ${greetings.length * stepTime}ms linear`;
  requestAnimationFrame(() => { progress.style.width = '100%'; });

  const cycle = setInterval(() => {
    i++;
    if (i < greetings.length) {
      word.textContent = greetings[i];
    } else {
      clearInterval(cycle);
      setTimeout(finishLoad, 300);
    }
  }, stepTime);

  function finishLoad(){
    preloader.classList.add('is-done');
    document.body.classList.remove('is-loading');
    startTypewriter();
  }

  // Fallback in case something blocks the interval (e.g. tab backgrounded)
  window.addEventListener('load', () => {
    setTimeout(() => {
      if (!preloader.classList.contains('is-done')) finishLoad();
    }, 3500);
  });

  /* ===============================
     TYPEWRITER — types "Alish" next to the blinking cursor
  =============================== */
  function startTypewriter(){
    const target = document.getElementById('typeTarget');
    const text = 'Alish';
    let n = 0;
    const type = setInterval(() => {
      target.textContent = text.slice(0, n + 1);
      n++;
      if (n === text.length) clearInterval(type);
    }, 100);
  }

});