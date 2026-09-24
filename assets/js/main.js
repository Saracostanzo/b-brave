/* Site behaviour. Every initialiser bails out when its markup is absent, so
   the same file serves all seven pages. No scroll listeners anywhere: the
   header state comes from an IntersectionObserver on a sentinel. */

(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* --- theme ------------------------------------------------------------- */

  function initTheme() {
    var toggle = document.getElementById('theme-toggle');
    if (!toggle) return;

    var systemDark = window.matchMedia('(prefers-color-scheme: dark)');

    function resolved() {
      var set = document.documentElement.dataset.theme;
      if (set) return set;
      return systemDark.matches ? 'dark' : 'light';
    }

    toggle.addEventListener('click', function () {
      var next = resolved() === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem('bb-theme', next); } catch (e) {}
    });
  }

  /* --- header state ------------------------------------------------------- */

  function initHeaderState() {
    var header = document.getElementById('site-header');
    if (!header) return;

    var sentinel = document.createElement('div');
    sentinel.setAttribute('aria-hidden', 'true');
    sentinel.style.cssText = 'position:absolute;top:0;height:1px;width:1px;';
    document.body.prepend(sentinel);

    new IntersectionObserver(function (entries) {
      header.classList.toggle('is-scrolled', !entries[0].isIntersecting);
    }).observe(sentinel);
  }

  /* --- reveal on scroll --------------------------------------------------- */

  function initReveal() {
    var items = document.querySelectorAll('[data-reveal]');
    if (!items.length) return;

    if (reduceMotion) {
      items.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -10% 0px' });

    items.forEach(function (el) { observer.observe(el); });
  }

  /* --- hero network ------------------------------------------------------- */

  function initHeroGraph() {
    var graph = document.getElementById('hero-graph');
    var chips = document.getElementById('sector-chips');
    var note = document.getElementById('sector-note');
    if (!graph || !chips) return;

    var DEFAULT_NOTE = 'home.hero.sectorDefault';
    var buttons = chips.querySelectorAll('[data-sector]');

    // the key stays on the element so the language switch retranslates it
    function say(key) {
      if (!note) return;
      note.setAttribute('data-i18n', key);
      if (window.I18N_T) note.textContent = window.I18N_T(key);
    }

    buttons.forEach(function (chip) {
      chip.addEventListener('click', function () {
        var select = chip.getAttribute('aria-pressed') !== 'true';

        buttons.forEach(function (other) {
          other.setAttribute('aria-pressed', String(select && other === chip));
        });

        if (select) {
          graph.dataset.highlight = chip.dataset.sector;
          say(chip.dataset.desc);
        } else {
          delete graph.dataset.highlight;
          say(DEFAULT_NOTE);
        }
      });
    });
  }

  /* --- in-page navigation with scrollspy ----------------------------------- */

  function initScrollSpy() {
    var nav = document.querySelector('[data-scrollspy]');
    if (!nav) return;

    var links = Array.prototype.slice.call(nav.querySelectorAll('a[href^="#"]'));
    var sections = links
      .map(function (link) { return document.getElementById(link.getAttribute('href').slice(1)); })
      .filter(Boolean);
    if (!sections.length) return;

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        links.forEach(function (link) {
          var match = link.getAttribute('href').slice(1) === entry.target.id;
          if (match) {
            link.setAttribute('aria-current', 'true');
          } else {
            link.removeAttribute('aria-current');
          }
        });
      });
    }, { rootMargin: '-30% 0px -60% 0px' });

    sections.forEach(function (section) { observer.observe(section); });
  }

  /* --- topic filter -------------------------------------------------------- */

  function initFilters() {
    var group = document.querySelector('[data-filter-group]');
    if (!group) return;

    var items = document.querySelectorAll('[data-topic]');
    var status = document.getElementById('filter-status');

    group.querySelectorAll('[data-filter]').forEach(function (button) {
      button.addEventListener('click', function () {
        var value = button.dataset.filter;
        var shown = 0;

        group.querySelectorAll('[data-filter]').forEach(function (other) {
          other.setAttribute('aria-pressed', String(other === button));
        });

        items.forEach(function (item) {
          var match = value === 'all' || item.dataset.topic === value;
          item.hidden = !match;
          if (match) shown += 1;
        });

        if (status) {
          status.textContent = window.I18N_T
            ? window.I18N_T('insights.count', { n: shown })
            : String(shown);
        }
      });
    });
  }

  /* --- forms --------------------------------------------------------------- */

  function initForms() {
    document.querySelectorAll('form[data-validate]').forEach(function (form) {
      form.setAttribute('novalidate', '');

      var summary = form.querySelector('.form__summary');
      var summaryList = summary ? summary.querySelector('ul') : null;
      var success = document.getElementById(form.dataset.success);

      function messageFor(field) {
        var key = field.validity.valueMissing ? 'required' : 'invalid';
        if (field.type === 'email' && !field.validity.valueMissing) key = 'email';
        return window.I18N_T ? window.I18N_T('form.error.' + key) : 'Campo non valido';
      }

      function fieldLabel(field) {
        // long labels (the consent checkbox) carry a short name for the summary
        var short = field.dataset.labelKey;
        if (short && window.I18N_T) return window.I18N_T(short);
        var label = form.querySelector('label[for="' + field.id + '"]');
        return label ? label.textContent.replace('*', '').trim() : field.name;
      }

      function describe(field, message) {
        var error = form.querySelector('#' + field.id + '-error');
        if (error) error.textContent = message || '';
        if (message) {
          field.setAttribute('aria-invalid', 'true');
        } else {
          field.removeAttribute('aria-invalid');
        }
      }

      form.addEventListener('submit', function (event) {
        event.preventDefault();

        var invalid = [];

        form.querySelectorAll('input, select, textarea').forEach(function (field) {
          if (!field.name) return;
          if (field.checkValidity()) {
            describe(field, '');
          } else {
            var message = messageFor(field);
            describe(field, message);
            invalid.push({ field: field, message: message });
          }
        });

        if (invalid.length) {
          if (summary && summaryList) {
            summaryList.textContent = '';
            invalid.forEach(function (entry) {
              var li = document.createElement('li');
              var link = document.createElement('a');
              link.href = '#' + entry.field.id;
              link.textContent = fieldLabel(entry.field) + ' — ' + entry.message;
              link.addEventListener('click', function (clickEvent) {
                clickEvent.preventDefault();
                entry.field.focus();
              });
              li.appendChild(link);
              summaryList.appendChild(li);
            });
            summary.hidden = false;
          }
          invalid[0].field.focus();
          return;
        }

        if (summary) summary.hidden = true;

        if (success) {
          form.hidden = true;
          success.hidden = false;
          success.focus();
        }
      });

      form.querySelectorAll('input, select, textarea').forEach(function (field) {
        field.addEventListener('input', function () {
          if (field.getAttribute('aria-invalid') === 'true' && field.checkValidity()) {
            describe(field, '');
          }
        });
      });
    });
  }

  /* --- footer year ---------------------------------------------------------- */

  function initYear() {
    var year = document.getElementById('year');
    if (year) year.textContent = String(new Date().getFullYear());
  }

  initTheme();
  initHeaderState();
  initReveal();
  initHeroGraph();
  initScrollSpy();
  initFilters();
  initForms();
  initYear();
})();
