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
      return { stage: s.stage || {}, all: !!s.all, guesses: s.guesses || { right: 0, wrong: 0, streak: 0, best: 0 } };
    } catch (e) {
      return { stage: {}, all: false, guesses: { right: 0, wrong: 0, streak: 0, best: 0 } };
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
      if (!card.classList.contains('is-unreleased')) card.classList.toggle('is-revealed', stageOf(card.dataset.slug) > 0);
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

  /* ---------- grid cards */
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest('.card .reveal-btn');
    if (!b) return;
    var card = b.closest('.card');
    var slug = card.dataset.slug;
    if (card.classList.contains('is-revealed')) {
      if (state.all) return;
      setStage(slug, 0);
      card.classList.remove('is-revealed');
    } else {
      setStage(slug, 1);
      card.classList.add('is-revealed');
      if (!reduce) { card.classList.add('is-slamming'); setTimeout(function () { card.classList.remove('is-slamming'); }, 900); }
    }
    filterGrid(true);
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
  function filterGrid(keepCount) {
    var cards = document.querySelectorAll('.card');
    if (!cards.length) return;
    var term = norm(q && q.value.trim());
    var shown = 0;
    cards.forEach(function (c) {
      var ok = true;
      if (filter === 'film' || filter === 'tv') ok = c.dataset.type === filter;
      if (filter === 'revealed') ok = c.classList.contains('is-revealed');
      if (ok && term) ok = norm(c.dataset.title).indexOf(term) > -1 || norm(c.dataset.character).indexOf(term) > -1 || c.dataset.year.indexOf(term) > -1;
      c.classList.toggle('is-hidden', !ok);
      if (ok) shown++;
    });
    document.querySelectorAll('.decade').forEach(function (d) {
      d.hidden = !d.querySelector('.card:not(.is-hidden)');
    });
    var empty = document.getElementById('empty');
    if (empty) empty.hidden = shown > 0;
    var rc = document.getElementById('result-count');
    if (rc && !keepCount) {
      rc.textContent = (term || filter !== 'all') ? shown + (shown === 1 ? ' title' : ' titles') : '';
    }
  }
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
    var i = Math.floor(Math.random() * titles.length);
    if (titles.length) word.textContent = titles[i];
    setInterval(function () {
      if (document.hidden) return;
      rotor.classList.add('is-out');
      setTimeout(function () {
        i = (i + 1 + Math.floor(Math.random() * 5)) % titles.length;
        word.textContent = titles[i];
        rotor.classList.remove('is-out');
      }, 340);
    }, 2600);
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
  if (film) {
    /* deep link from a card's "How?" opens straight to the moment */
    if (/[?&]spoil=1/.test(location.search) && stageOf(film.dataset.slug) < 2) setStage(film.dataset.slug, 2);
    syncFilm(film, /[?&]spoil=1/.test(location.search));
    film.addEventListener('click', function (ev) {
      var g = ev.target.closest('.guess-btn');
      var r = ev.target.closest('[data-reveal]');
      var sp = ev.target.closest('[data-spoil]');
      var rs = ev.target.closest('[data-reseal]');
      var slug = film.dataset.slug;
      if (g) {
        var actual = film.dataset.verdict;
        var right = actual === g.dataset.guess;
        var msg;
        if (actual === 'ambiguous') { msg = 'Trick question. This one is complicated. No points either way.'; }
        else if (right) { state.guesses.right++; state.guesses.streak++; state.guesses.best = Math.max(state.guesses.best, state.guesses.streak); msg = 'You called it.'; }
        else { state.guesses.wrong++; state.guesses.streak = 0; msg = 'Not this time.'; }
        setStage(slug, 1);
        syncFilm(film, true);
        film.querySelector('[data-guess-result]').textContent = msg;
      } else if (r) {
        setStage(slug, 1);
        syncFilm(film, true);
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

  applyAll();
  filterGrid();
  document.documentElement.classList.add('is-ready');
})();
