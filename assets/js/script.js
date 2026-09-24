/* Tutto il comportamento del sito sta qui. Ogni blocco controlla prima che il
   suo markup esista, così lo stesso file serve tutte e sette le pagine.
   Non c'è un listener sullo scroll: dove serve sapere a che punto
   della pagina siamo uso IntersectionObserver, che è molto più leggero. */

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

/* localStorage può lanciare (finestra anonima, cookie bloccati): una
   preferenza non salvata non deve rompere la pagina */
function remember(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

function recall(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/* --- lingua ----------------------------------------------------------------
   Ogni testo traducibile porta una chiave:
     data-i18n="chiave"                      il testo dell'elemento
     data-i18n-html="chiave"                 testo con un po' di markup dentro
     data-i18n-attr="attributo:chiave; ..."  attributi, <title> e <meta>
   Le pagine nascono in italiano, quindi senza JavaScript si leggono lo stesso
   e smette di funzionare solo l'interruttore.
   -------------------------------------------------------------------------- */

let lang = 'it';

function t(key, vars) {
  let text = TRANSLATIONS[lang]?.[key] ?? TRANSLATIONS.it[key];

  if (text === undefined) {
    console.warn('[lingua] manca la chiave:', key);
    return '';
  }

  for (const [name, value] of Object.entries(vars ?? {})) {
    text = text.replaceAll(`{${name}}`, value);
  }

  return text;
}

function setLanguage(next) {
  lang = TRANSLATIONS[next] ? next : 'it';
  document.documentElement.lang = lang;

  $$('[data-i18n]').forEach(el => (el.textContent = t(el.dataset.i18n)));
  $$('[data-i18n-html]').forEach(el => (el.innerHTML = t(el.dataset.i18nHtml)));

  $$('[data-i18n-attr]').forEach(el => {
    for (const pair of el.dataset.i18nAttr.split(';')) {
      const [attribute, key] = pair.split(':').map(part => part.trim());
      if (attribute && key) el.setAttribute(attribute, t(key));
    }
  });

  $$('[data-lang]').forEach(button => {
    button.setAttribute('aria-pressed', button.dataset.lang === lang);
  });

  remember('bb-lang', lang);
}

if (recall('bb-lang') === 'en') setLanguage('en');

$$('[data-lang]').forEach(button => {
  button.addEventListener('click', () => setLanguage(button.dataset.lang));
});

/* --- tema chiaro e scuro ---------------------------------------------------
   Il CSS fa già tutto da solo con light-dark(): qui cambia solo l'attributo
   sull'<html>, e tutta la palette ruota dietro.
   -------------------------------------------------------------------------- */

$('#theme-toggle')?.addEventListener('click', () => {
  const preference = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  const current = document.documentElement.dataset.theme || preference;
  const next = current === 'dark' ? 'light' : 'dark';

  document.documentElement.dataset.theme = next;
  remember('bb-theme', next);
});

/* su telefono il menu scorre di lato: porto in vista la voce della pagina in
   cui siamo, altrimenti su alcune pagine resta fuori dallo schermo */
$('.nav-list a[aria-current="page"]')?.scrollIntoView({ block: 'nearest', inline: 'center' });

/* --- il filetto sotto l'header compare quando la pagina si muove ----------- */

const header = $('#site-header');

if (header) {
  const sentinella = document.createElement('div');
  sentinella.setAttribute('aria-hidden', 'true');
  sentinella.style.cssText = 'position:absolute;top:0;width:1px;height:1px';
  document.body.prepend(sentinella);

  new IntersectionObserver(([top]) => {
    header.classList.toggle('is-scrolled', !top.isIntersecting);
  }).observe(sentinella);
}

/* --- comparsa dei blocchi allo scroll ------------------------------------- */

const daRivelare = $$('[data-reveal]');

if (reducedMotion) {
  daRivelare.forEach(el => el.classList.add('is-visible'));
} else {
  const rivelatore = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-visible');
      rivelatore.unobserve(entry.target);
    }
  }, { threshold: 0.15, rootMargin: '0px 0px -10% 0px' });

  daRivelare.forEach(el => rivelatore.observe(el));
}

/* --- i settori nell'hero, solo in home -------------------------------------
   Il click accende il pezzo di rete che riguarda quel settore e scrive sotto
   una riga che dice cosa ci facciamo. La chiave della frase resta
   sull'elemento, così cambiando lingua si traduce da sola.
   -------------------------------------------------------------------------- */

const grafo = $('#hero-graph');
const notaSettore = $('#sector-note');

$$('#sector-chips [data-sector]').forEach((chip, _, chips) => {
  chip.addEventListener('click', () => {
    const seleziona = chip.getAttribute('aria-pressed') !== 'true';
    chips.forEach(altro => altro.setAttribute('aria-pressed', seleziona && altro === chip));

    if (seleziona) grafo.dataset.highlight = chip.dataset.sector;
    else delete grafo.dataset.highlight;

    notaSettore.dataset.i18n = seleziona ? chip.dataset.desc : 'home.hero.sectorDefault';
    notaSettore.textContent = t(notaSettore.dataset.i18n);
  });
});

/* --- indice laterale della pagina Competenze ------------------------------- */

const indice = $('[data-scrollspy]');

if (indice) {
  const voci = $$('a[href^="#"]', indice);
  const osservatore = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      for (const voce of voci) {
        if (voce.getAttribute('href') === `#${entry.target.id}`) voce.setAttribute('aria-current', 'true');
        else voce.removeAttribute('aria-current');
      }
    }
  }, { rootMargin: '-30% 0px -60% 0px' });

  voci.forEach(voce => osservatore.observe($(voce.getAttribute('href'))));
}

/* --- filtro per tema nella pagina Insights --------------------------------- */

const filtri = $('[data-filter-group]');

if (filtri) {
  const bottoni = $$('[data-filter]', filtri);
  const articoli = $$('[data-topic]');
  const conteggio = $('#filter-status');

  bottoni.forEach(bottone => {
    bottone.addEventListener('click', () => {
      bottoni.forEach(altro => altro.setAttribute('aria-pressed', altro === bottone));

      const tema = bottone.dataset.filter;
      const visibili = articoli.filter(a => tema === 'all' || a.dataset.topic === tema);

      articoli.forEach(a => (a.hidden = !visibili.includes(a)));
      conteggio.textContent = t('insights.count', { n: visibili.length });
    });
  });
}

/* --- moduli ----------------------------------------------------------------
   Controllo con le API di validazione del browser, ma con messaggi miei e in
   due lingue. Dietro non c'è un server: al primo invio valido mostro il
   pannello di conferma con l'indirizzo email vero.
   -------------------------------------------------------------------------- */

$$('form[data-validate]').forEach(form => {
  const riepilogo = $('.form__summary', form);
  const conferma = document.getElementById(form.dataset.success);
  const campi = $$('input, select, textarea', form).filter(campo => campo.name);

  /* l'etichetta del consenso è lunghissima: quei campi portano una chiave corta */
  const etichetta = campo => campo.dataset.labelKey
    ? t(campo.dataset.labelKey)
    : $(`label[for="${campo.id}"]`, form).textContent.replace('*', '').trim();

  const messaggio = campo => {
    if (campo.validity.valueMissing) return t('form.error.required');
    if (campo.type === 'email') return t('form.error.email');
    return t('form.error.invalid');
  };

  const segnala = (campo, testo) => {
    document.getElementById(`${campo.id}-error`).textContent = testo;
    if (testo) campo.setAttribute('aria-invalid', 'true');
    else campo.removeAttribute('aria-invalid');
  };

  form.addEventListener('submit', evento => {
    evento.preventDefault();

    const sbagliati = campi.filter(campo => !campo.checkValidity());
    campi.forEach(campo => segnala(campo, sbagliati.includes(campo) ? messaggio(campo) : ''));

    if (sbagliati.length) {
      $('ul', riepilogo).replaceChildren(...sbagliati.map(campo => {
        const link = document.createElement('a');
        link.href = `#${campo.id}`;
        link.textContent = `${etichetta(campo)} — ${messaggio(campo)}`;
        link.addEventListener('click', e => {
          e.preventDefault();
          campo.focus();
        });

        const riga = document.createElement('li');
        riga.append(link);
        return riga;
      }));

      riepilogo.hidden = false;
      sbagliati[0].focus();
      return;
    }

    riepilogo.hidden = true;
    form.hidden = true;
    conferma.hidden = false;
    conferma.focus();
  });

  campi.forEach(campo => {
    campo.addEventListener('input', () => {
      if (campo.getAttribute('aria-invalid') === 'true' && campo.checkValidity()) segnala(campo, '');
    });
  });
});

/* --- l'anno nel footer si aggiorna da solo --------------------------------- */

const anno = $('#year');
if (anno) anno.textContent = new Date().getFullYear();
