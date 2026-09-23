/* Client-side language switch.

   Every translatable string carries a key:
     data-i18n="key"                       -> textContent
     data-i18n-html="key"                  -> innerHTML (values are ours)
     data-i18n-attr="placeholder:key; ..." -> any attribute, including
                                              <meta content> and aria-label

   The markup ships in Italian, so with scripting off the page is already
   readable and only the switch itself stops working. The choice lives in
   localStorage: on file:// there is no origin, so a ?lang= parameter and
   history.pushState are not available. */

(function () {
  'use strict';

  var DEFAULT = 'it';
  var dict = window.I18N || {};
  var warned = {};
  var current = DEFAULT;

  function translate(key, vars) {
    var table = dict[current] || {};
    var value = table[key];

    if (value === undefined) {
      value = (dict[DEFAULT] || {})[key];
      if (value === undefined) {
        if (!warned[key]) {
          warned[key] = true;
          console.warn('[i18n] missing key:', key);
        }
        return '';
      }
    }

    if (vars) {
      Object.keys(vars).forEach(function (name) {
        value = value.split('{' + name + '}').join(String(vars[name]));
      });
    }

    return value;
  }

  function applyAttributes(element) {
    var spec = element.getAttribute('data-i18n-attr');
    if (!spec) return;

    spec.split(';').forEach(function (pair) {
      var parts = pair.split(':');
      if (parts.length !== 2) return;
      var attribute = parts[0].trim();
      var key = parts[1].trim();
      if (!attribute || !key) return;
      element.setAttribute(attribute, translate(key));
    });
  }

  function apply(lang) {
    current = dict[lang] ? lang : DEFAULT;
    document.documentElement.lang = current;

    document.querySelectorAll('[data-i18n]').forEach(function (element) {
      element.textContent = translate(element.getAttribute('data-i18n'));
    });

    document.querySelectorAll('[data-i18n-html]').forEach(function (element) {
      element.innerHTML = translate(element.getAttribute('data-i18n-html'));
    });

    document.querySelectorAll('[data-i18n-attr]').forEach(applyAttributes);

    document.querySelectorAll('[data-lang]').forEach(function (button) {
      button.setAttribute('aria-pressed', String(button.dataset.lang === current));
    });

    try { localStorage.setItem('bb-lang', current); } catch (e) {}
  }

  var stored = DEFAULT;
  try { stored = localStorage.getItem('bb-lang') || DEFAULT; } catch (e) {}

  if (stored !== DEFAULT) apply(stored);

  document.querySelectorAll('[data-lang]').forEach(function (button) {
    button.addEventListener('click', function () {
      apply(button.dataset.lang);
    });
  });

  window.I18N_T = translate;
})();
