/* doesbradpittdie.com — staged reveal, search, hero rotor, guessing, motion */
(function () {
  'use strict';
  var KEY = 'dbpd:v2';
  var state = load();
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY) || '{}');
      return { stage: s.stage || {}, all: !!s.all, guesses: s.guesses || { right: 0, wrong: 0, streak: 0, best: 0 }, guessed: s.guessed || {} };
    } catch (e) {
      return { stage: {}, all: false, guesses: { right: 0, wrong: 0, streak: 0, best: 0 }, guessed: {} };
    }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* private mode: fine */ } }
  function stageOf(slug) { return Math.max(state.all ? 1 : 0, state.stage[slug] || 0); }
  function setStage(slug, n) { if (n > 0) state.stage[slug] = n; else delete state.stage[slug]; save(); }

  /* ---------- split text into animated words */
  function splitWords(el) {
    if (el.dataset.splitDone) return;
    var words = el.textContent.trim().split(/\s+/);
    el.textContent = '';
    words.forEach(function (w, i) {
      var s = document.createElement('span');
      s.className = 'w';
      s.style.setProperty('--i', i);
      s.textContent = w;
      el.appendChild(s);
      if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
    });
    el.dataset.splitDone = '1';
  }
  document.querySelectorAll('[data-split]').forEach(splitWords);

  /* ---------- global seal toggle */
  function applyAll() {
    document.documentElement.classList.toggle('all-revealed', state.all);
    var btn = document.querySelector('[data-seal-toggle]');
    if (btn) btn.setAttribute('aria-pressed', String(state.all));
    document.querySelectorAll('.card').forEach(function (card) {
      if (card.classList.contains('is-unreleased')) return;
      var open = stageOf(card.dataset.slug) > 0;
      card.classList.toggle('is-revealed', open);
      var gb = card.querySelector('[data-guess-box]'), rb = card.querySelector('[data-result-box]');
      if (gb) gb.hidden = open;
      if (rb) {
        rb.hidden = !open;
        var c = rb.querySelector('[data-call]');
        var gd = state.guessed[card.dataset.slug];
        if (c) { c.hidden = !gd; c.textContent = gd === 'right' ? 'You called it.' : gd === 'wrong' ? 'You guessed wrong.' : gd === 'na' ? 'Trick question.' : ''; c.className = 'cr-call ' + (gd === 'right' ? 'is-right' : gd === 'wrong' ? 'is-wrong' : gd ? 'is-na' : ''); }
      }
    });
    document.querySelectorAll('.tease-n').forEach(function (n) {
      if (state.all) countUp(n, +n.dataset.count); else n.textContent = '?';
    });
    var film = document.querySelector('.film');
    if (film) syncFilm(film, false);
  }
  function countUp(el, to) {
    if (reduce || el.dataset.counted === String(to)) { el.textContent = to; el.dataset.counted = to; return; }
    el.dataset.counted = to;
    var t0 = performance.now(), dur = 900;
    (function tick(now) {
      var p = Math.min(1, (now - t0) / dur), ease = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(to * ease);
      if (p < 1) requestAnimationFrame(tick);
    })(t0);
  }
  document.addEventListener('click', function (ev) {
    var t = ev.target.closest('[data-seal-toggle]');
    if (!t) return;
    state.all = !state.all;
    save();
    applyAll();
    filterGrid();
  });

  /* ---------- scoring shared by cards, spotlight and film pages */
  function scoreGuess(slug, actual, guess) {
    if (state.guessed[slug]) return { msg: 'Already guessed. It only counts once.', cls: 'is-dup' };
    if (actual === 'ambiguous') { state.guessed[slug] = 'na'; save(); return { msg: 'Trick question. No points either way.', cls: 'is-na' }; }
    if (actual === guess) {
      state.guesses.right++; state.guesses.streak++; state.guesses.best = Math.max(state.guesses.best, state.guesses.streak);
      state.guessed[slug] = 'right'; save();
      return { msg: 'You called it.' + (state.guesses.streak > 1 ? ' Streak ' + state.guesses.streak + '.' : ''), cls: 'is-right' };
    }
    state.guesses.wrong++; state.guesses.streak = 0; state.guessed[slug] = 'wrong'; save();
    return { msg: 'Not this time.', cls: 'is-wrong' };
  }

  /* ---------- grid cards: guess inline, reveal, seal */
  function revealCard(card, call) {
    card.classList.add('is-revealed');
    var gb = card.querySelector('[data-guess-box]'), rb = card.querySelector('[data-result-box]');
    if (gb) gb.hidden = true;
    if (rb) {
      rb.hidden = false;
      var c = rb.querySelector('[data-call]');
      if (c) { c.textContent = call ? call.msg : ''; c.className = 'cr-call ' + (call ? call.cls : ''); c.hidden = !call; }
    }
    if (!reduce) { card.classList.add('is-slamming'); setTimeout(function () { card.classList.remove('is-slamming'); }, 900); }
  }
  function sealCard(card) {
    card.classList.remove('is-revealed');
    var gb = card.querySelector('[data-guess-box]'), rb = card.querySelector('[data-result-box]');
    if (gb) gb.hidden = false;
    if (rb) rb.hidden = true;
  }
  document.addEventListener('click', function (ev) {
    var card = ev.target.closest('.card');
    if (!card) return;
    var slug = card.dataset.slug;
    var g = ev.target.closest('[data-cguess]');
    var r = ev.target.closest('.card [data-reveal]');
    var s = ev.target.closest('[data-cseal]');
    if (g) {
      var call = scoreGuess(slug, card.dataset.verdict, g.dataset.cguess);
      setStage(slug, 1);
      revealCard(card, call);
      filterGrid(true);
    } else if (r) {
      setStage(slug, 1);
      revealCard(card, null);
      filterGrid(true);
    } else if (s) {
      if (state.all) { state.all = false; applyAll(); }
      setStage(slug, 0);
      sealCard(card);
      filterGrid(true);
    }
  });

  /* ---------- spotlight carousel */
  var spot = document.querySelector('[data-spotlight]');
  if (spot) {
    var slides = spot.querySelectorAll('.slide');
    var dots = document.querySelectorAll('[data-dot]');
    var cur = 0, spotTimer;
    function go(n, manual) {
      cur = (n + slides.length) % slides.length;
      slides.forEach(function (s, i) { s.classList.toggle('is-on', i === cur); });
      dots.forEach(function (d, i) { d.classList.toggle('is-on', i === cur); });
      if (manual) restart();
    }
    function restart() {
      clearInterval(spotTimer);
      if (reduce || slides.length < 2) return;
      spotTimer = setInterval(function () { if (!document.hidden) go(cur + 1); }, 6500);
    }
    dots.forEach(function (d) { d.addEventListener('click', function () { go(+d.dataset.dot, true); }); });
    spot.addEventListener('keydown', function (e) { if (e.key === 'ArrowRight') go(cur + 1, true); if (e.key === 'ArrowLeft') go(cur - 1, true); });
    var sx = null;
    spot.addEventListener('pointerdown', function (e) { sx = e.clientX; });
    spot.addEventListener('pointerup', function (e) { if (sx !== null && Math.abs(e.clientX - sx) > 40) go(cur + (e.clientX < sx ? 1 : -1), true); sx = null; });
    restart();
    /* "Guess now" jumps to that title's card and lights it up */
    document.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-spot-guess]');
      if (!b) return;
      var card = document.querySelector('.card[data-slug="' + b.dataset.spotGuess + '"]');
      if (!card) return;
      if (q) { q.value = ''; }
      filter = 'all'; chips.forEach(function (c) { var on = c.dataset.filter === 'all'; c.classList.toggle('is-on', on); c.setAttribute('aria-pressed', String(on)); });
      var dec = document.getElementById('decade'); if (dec) dec.value = '';
      filterGrid();
      card.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
      card.classList.add('is-lit');
      setTimeout(function () { card.classList.remove('is-lit'); }, 2600);
      var first = card.querySelector('[data-cguess]'); if (first) setTimeout(function () { first.focus({ preventScroll: true }); }, 700);
    });
  }

  /* ---------- surprise me */
  document.addEventListener('click', function (ev) {
    if (!ev.target.closest('[data-surprise]')) return;
    var cards = Array.prototype.slice.call(document.querySelectorAll('.card:not(.is-unreleased)'));
    var fresh = cards.filter(function (c) { return !state.guessed[c.dataset.slug] && !c.classList.contains('is-revealed'); });
    var pick = (fresh.length ? fresh : cards)[Math.floor(Math.random() * (fresh.length ? fresh : cards).length)];
    if (!pick) return;
    location.href = 'film/' + pick.dataset.slug + '/';
  });

  /* ---------- 3D tilt on posters (pointer devices only) */
  if (fine && !reduce) {
    document.addEventListener('pointermove', function (ev) {
      var p = ev.target.closest && ev.target.closest('.poster, .film-poster');
      if (!p) return;
      var r = p.getBoundingClientRect();
      var x = (ev.clientX - r.left) / r.width - 0.5;
      var y = (ev.clientY - r.top) / r.height - 0.5;
      p.style.setProperty('--rx', (-y * 10).toFixed(2) + 'deg');
      p.style.setProperty('--ry', (x * 12).toFixed(2) + 'deg');
      p.style.setProperty('--gx', ((x + 0.5) * 100).toFixed(1) + '%');
      p.style.setProperty('--gy', ((y + 0.5) * 100).toFixed(1) + '%');
      p.classList.add('is-tilting');
    });
    document.addEventListener('pointerout', function (ev) {
      var p = ev.target.closest && ev.target.closest('.poster, .film-poster');
      if (!p || (ev.relatedTarget && p.contains(ev.relatedTarget))) return;
      p.classList.remove('is-tilting');
      p.style.removeProperty('--rx'); p.style.removeProperty('--ry');
    });
    /* hero spotlight follows the pointer */
    var hero = document.querySelector('.hero');
    if (hero) {
      hero.addEventListener('pointermove', function (ev) {
        var r = hero.getBoundingClientRect();
        hero.style.setProperty('--mx', ((ev.clientX - r.left) / r.width * 100).toFixed(1) + '%');
        hero.style.setProperty('--my', ((ev.clientY - r.top) / r.height * 100).toFixed(1) + '%');
      });
    }
  }

  /* ---------- entrance: cards wipe in as they arrive */
  if (!reduce && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var card = en.target;
        var siblings = Array.prototype.slice.call(card.parentNode.children).filter(function (c) { return !c.classList.contains('is-hidden'); });
        var idx = siblings.indexOf(card);
        var perRow = Math.max(1, Math.round(card.parentNode.getBoundingClientRect().width / card.getBoundingClientRect().width));
        card.style.setProperty('--d', ((idx % perRow) * 60) + 'ms');
        card.classList.add('is-in');
        io.unobserve(card);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.15 });
    document.querySelectorAll('.card').forEach(function (c) { c.classList.add('will-enter'); io.observe(c); });
  }

  /* ---------- search + filters */
  var q = document.getElementById('q');
  var chips = document.querySelectorAll('.chip');
  var filter = 'all';
  function norm(s) { return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  var decadeSel = document.getElementById('decade');
  var sortSel = document.getElementById('sort');
  function sortGrid() {
    var grid = document.getElementById('grid');
    if (!grid || !sortSel) return;
    var mode = sortSel.value;
    var cards = Array.prototype.slice.call(grid.children);
    cards.sort(function (a, b) {
      if (mode === 'new') return (+b.dataset.year - +a.dataset.year) || a.dataset.title.localeCompare(b.dataset.title);
      if (mode === 'old') return (+a.dataset.year - +b.dataset.year) || a.dataset.title.localeCompare(b.dataset.title);
      if (mode === 'az') return a.dataset.title.replace(/^the /, '').localeCompare(b.dataset.title.replace(/^the /, ''));
      return (+a.dataset.feat - +b.dataset.feat) || (+b.dataset.year - +a.dataset.year);
    });
    cards.forEach(function (c) { grid.appendChild(c); });
  }
  function filterGrid(keepCount) {
    var cards = document.querySelectorAll('.card');
    if (!cards.length) return;
    var term = norm(q && q.value.trim());
    var dec = decadeSel ? decadeSel.value : '';
    var shown = 0;
    cards.forEach(function (c) {
      var ok = true;
      if (filter === 'film' || filter === 'tv') ok = c.dataset.type === filter;
      if (filter === 'revealed') ok = c.classList.contains('is-revealed');
      if (ok && dec) ok = Math.floor(+c.dataset.year / 10) * 10 === +dec;
      if (ok && term) ok = norm(c.dataset.title).indexOf(term) > -1 || norm(c.dataset.character).indexOf(term) > -1 || c.dataset.year.indexOf(term) > -1;
      c.classList.toggle('is-hidden', !ok);
      if (ok) shown++;
    });
    var empty = document.getElementById('empty');
    if (empty) empty.hidden = shown > 0;
    var rc = document.getElementById('result-count');
    if (rc && !keepCount) {
      rc.textContent = shown + (shown === 1 ? ' title' : ' titles') + ((term || filter !== 'all' || dec) ? ' match' : ' in the archive');
    }
  }
  if (decadeSel) decadeSel.addEventListener('change', function () { filterGrid(); });
  if (sortSel) sortSel.addEventListener('change', function () { sortGrid(); filterGrid(true); });
  if (q) {
    q.addEventListener('input', function () { filterGrid(); });
    q.addEventListener('keydown', function (e) { if (e.key === 'Escape') { q.value = ''; filterGrid(); } });
    document.addEventListener('keydown', function (e) {
      if (e.key === '/' && document.activeElement !== q && !/input|textarea/i.test(document.activeElement.tagName)) { e.preventDefault(); q.focus(); }
    });
  }
  chips.forEach(function (ch) {
    ch.addEventListener('click', function () {
      filter = ch.dataset.filter;
      chips.forEach(function (c) { c.classList.toggle('is-on', c === ch); c.setAttribute('aria-pressed', String(c === ch)); });
      filterGrid();
    });
  });

  /* ---------- hero rotor */
  var rotor = document.querySelector('.rotor');
  if (rotor && !reduce) {
    var titles;
    try { titles = JSON.parse(rotor.dataset.titles); } catch (e) { titles = []; }
    var word = rotor.querySelector('.rotor-word');
    var bdImgs = document.querySelectorAll('.hero-bd-img');
    var bdOn = 0;
    var i = Math.floor(Math.random() * titles.length);
    function showBackdrop(src) {
      if (!bdImgs.length || !src) return;
      var next = bdImgs[1 - bdOn];
      var pre = new Image();
      pre.onload = function () {
        next.src = src;
        next.classList.add('is-on');
        bdImgs[bdOn].classList.remove('is-on');
        bdOn = 1 - bdOn;
      };
      pre.src = src;
    }
    if (titles.length) { word.textContent = titles[i].t; if (bdImgs.length && titles[i].b) { bdImgs[0].src = titles[i].b; } }
    setInterval(function () {
      if (document.hidden) return;
      rotor.classList.add('is-out');
      setTimeout(function () {
        i = (i + 1 + Math.floor(Math.random() * 5)) % titles.length;
        word.textContent = titles[i].t;
        rotor.classList.remove('is-out');
        showBackdrop(titles[i].b);
      }, 340);
    }, 3400);
  }


  /* ---------- film page: three gated stages */
  var film = document.querySelector('.film');
  function syncFilm(film, animate) {
    if (film.classList.contains('is-unreleased')) return;
    var slug = film.dataset.slug;
    var seal = film.querySelector('[data-seal]');
    var verdict = film.querySelector('.verdict');
    var n = stageOf(slug);
    seal.hidden = n > 0;
    verdict.hidden = n === 0;
    film.querySelectorAll('.stage').forEach(function (st) {
      var k = +st.dataset.stage;
      var wasHidden = st.hidden;
      st.hidden = k > n;
      if (!st.hidden && wasHidden && animate && !reduce) {
        st.classList.remove('is-live');
        void st.offsetWidth;
        st.classList.add('is-live');
      } else if (!st.hidden) {
        st.classList.add('is-live');
      }
      var gate = st.querySelector('.gate');
      if (gate) gate.hidden = +gate.dataset.gate <= n;
    });
    if (n > 0) {
      if (animate && !reduce && !verdict.classList.contains('is-open')) {
        void verdict.offsetWidth;
        setTimeout(function () { verdict.classList.add('is-open'); }, 40);
      } else {
        verdict.classList.add('is-open');
      }
    } else {
      verdict.classList.remove('is-open');
      var gr = film.querySelector('[data-guess-result]');
      if (gr) gr.textContent = '';
    }
    var streak = film.querySelector('[data-streak]');
    if (streak) {
      var g = state.guesses;
      var total = g.right + g.wrong;
      streak.hidden = total === 0;
      if (total) streak.textContent = 'Your guesses: ' + g.right + ' of ' + total + ' right. Streak ' + g.streak + ', best ' + g.best + '.';
    }
  }
  /* pick a title the visitor has not guessed yet, and offer it */
  function suggestNext(film) {
    var slot = film.querySelector('[data-next]');
    if (!slot) return;
    var pool;
    try { pool = JSON.parse(film.dataset.pool || '[]'); } catch (e) { pool = []; }
    var fresh = pool.filter(function (p) { return !state.guessed[p.s] && !state.stage[p.s]; });
    if (!fresh.length) fresh = pool.filter(function (p) { return !state.guessed[p.s]; });
    if (!fresh.length) { slot.textContent = 'You have guessed every title. Reveal all on the front page to see how you did.'; slot.hidden = false; return; }
    var pick = fresh[Math.floor(Math.random() * fresh.length)];
    slot.innerHTML = 'Keep the streak going. <a href="../' + pick.s + '/">Guess ' + pick.t + ' (' + pick.y + ')</a>';
    slot.hidden = false;
  }

  /* the hint: iris open on one frame from the film, hold, close */
  var hintTimer;
  function showHint(film) {
    var h = film.querySelector('[data-hint]');
    if (!h || !h.hidden) return;
    var btn = film.querySelector('[data-hint-btn]');
    h.hidden = false;
    void h.offsetWidth;
    h.classList.add('is-on');
    var close = function () {
      clearTimeout(hintTimer);
      h.classList.remove('is-on');
      h.classList.add('is-out');
      setTimeout(function () { h.classList.remove('is-out'); h.hidden = true; if (btn) btn.focus(); }, 700);
    };
    hintTimer = setTimeout(close, reduce ? 2500 : 4200);
    h.addEventListener('click', close, { once: true });
    var esc = function (ev) { if (ev.key === 'Escape') { close(); document.removeEventListener('keydown', esc); } };
    document.addEventListener('keydown', esc);
    if (btn) { btn.lastChild.textContent = 'Another look'; }
  }

  if (film) {
    /* deep link from a card's "How?" opens straight to the moment */
    if (/[?&]spoil=1/.test(location.search) && stageOf(film.dataset.slug) < 2) setStage(film.dataset.slug, 2);
    syncFilm(film, /[?&]spoil=1/.test(location.search));
    if (stageOf(film.dataset.slug) > 0) suggestNext(film);
    film.addEventListener('click', function (ev) {
      var g = ev.target.closest('.guess-btn');
      var r = ev.target.closest('[data-reveal]');
      var sp = ev.target.closest('[data-spoil]');
      var rs = ev.target.closest('[data-reseal]');
      var slug = film.dataset.slug;
      if (g) {
        var call = scoreGuess(slug, film.dataset.verdict, g.dataset.guess);
        setStage(slug, 1);
        syncFilm(film, true);
        film.querySelector('[data-guess-result]').textContent = call.msg;
        suggestNext(film);
      } else if (r) {
        setStage(slug, 1);
        syncFilm(film, true);
        suggestNext(film);
      } else if (ev.target.closest('[data-hint-btn]')) {
        showHint(film);
      } else if (sp) {
        var next = +sp.dataset.spoil;
        setStage(slug, next);
        syncFilm(film, true);
        var target = film.querySelector('.stage-' + next);
        if (target && !reduce) setTimeout(function () { target.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 250);
      } else if (rs) {
        setStage(slug, 0);
        if (state.all) { state.all = false; applyAll(); }
        syncFilm(film, false);
        film.querySelectorAll('.stage').forEach(function (st) { st.classList.remove('is-live'); });
        var clipFrame = film.querySelector('.clip iframe');
        if (clipFrame) location.reload();
        var s = film.querySelector('[data-seal]');
        if (s) s.querySelector('.reveal-big').focus();
      }
    });
    var clip = film.querySelector('.clip');
    if (clip) {
      clip.querySelector('.clip-btn').addEventListener('click', function () {
        var id = clip.dataset.clip;
        var f = document.createElement('iframe');
        f.src = 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0';
        f.title = 'The scene';
        f.allow = 'autoplay; encrypted-media; picture-in-picture';
        f.allowFullscreen = true;
        f.referrerPolicy = 'strict-origin-when-cross-origin';
        this.replaceWith(f);
      });
    }
  }

  sortGrid();
  applyAll();
  filterGrid();
  document.documentElement.classList.add('is-ready');
})();
