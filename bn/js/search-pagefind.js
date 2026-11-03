// ===============================================================================================================
// BKY-SEARCH-3 — headless Pagefind adapter.
// ===============================================================================================================
// Pagefind ships a low-level JS API (`pagefind/pagefind.js`) next to the
// `PagefindUI` widget. The widget replaces the host form with its own markup,
// which silently drops the anchors that the interface-chrome contracts
// translate (placeholder, submit label). This adapter keeps the host form as
// the contract surface and delegates only the search to Pagefind:
//
//   form#pagefind-search-form   -> input[type=search] + submit button (chrome)
//   #pagefind-results           -> result list, filled by this adapter
//   data-pagefind-script        -> relative path to `pagefind/pagefind.js`
//   data-empty-label            -> already-translated "no results" label
//
// Pagefind emits one independent index per `<html lang>`; importing the bundle
// loads only the current language's index. The module is plain browser JS (no
// build step) and doubles as a CommonJS module for the node host tests.
// ===============================================================================================================

(function (root, factory) {
    'use strict';
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.BAKERY_SEARCH = factory();
    }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    var DEFAULT_SCRIPT = 'pagefind/pagefind.js';
    var MAX_RESULTS = 10;

    function normaliseQuery(value) {
        return String(value == null ? '' : value).trim();
    }

    function bundlePath(form, fallback) {
        var value = form && form.getAttribute ? form.getAttribute('data-pagefind-script') : null;
        return importSpecifier(value && value.trim() ? value.trim() : (fallback || DEFAULT_SCRIPT));
    }

    // A dynamic `import()` requires a URL: a bare `pagefind/pagefind.js` is
    // rejected as a module specifier. The templates keep the short, readable
    // value; the adapter normalises it to `./pagefind/pagefind.js` (or leaves
    // `/…`, `./…`, `../…` and absolute URLs untouched).
    function importSpecifier(value) {
        var path = String(value == null ? '' : value).trim();
        if (!path) return './' + DEFAULT_SCRIPT;
        if (path.charAt(0) === '/' || path.indexOf('./') === 0 || path.indexOf('../') === 0 || /^[a-z]+:/i.test(path)) {
            return path;
        }
        return './' + path;
    }

    function emptyLabel(container, fallback) {
        var value = container && container.getAttribute ? container.getAttribute('data-empty-label') : null;
        return value && value.trim() ? value.trim() : (fallback || '');
    }

    // The adapter is a classic script: a dynamic `import()` resolves against the
    // *script* URL (`/js/search-pagefind.js`), not the document. Resolve against
    // `document.baseURI` so a root page and a `{lang}/` variant both reach the
    // single shared `pagefind/` bundle.
    function resolveImportUrl(path, baseURI) {
        return new URL(importSpecifier(path), baseURI).href;
    }

    function loadDefault(path) {
        return import(resolveImportUrl(path, document.baseURI));
    }

    function renderItem(doc, data) {
        var link = doc.createElement('a');
        link.className = 'search-result d-block mb-3';
        link.setAttribute('href', data.url);

        var title = doc.createElement('strong');
        title.textContent = (data.meta && data.meta.title) || data.url;

        var excerpt = doc.createElement('p');
        excerpt.className = 'text-muted mb-0';
        excerpt.innerHTML = data.excerpt || '';

        link.appendChild(title);
        link.appendChild(excerpt);
        return link;
    }

    /**
     * Runs one query and fills the container. Returns the rendered result data
     * so the node host can assert the mapping without a browser event loop.
     */
    async function runSearch(options) {
        var container = options.container;
        var query = normaliseQuery(options.query);
        container.textContent = '';
        if (!query) return [];

        var search = await options.pagefind.search(query);
        var results = (search && search.results) || [];
        if (results.length === 0) {
            container.textContent = emptyLabel(container, options.emptyLabel);
            return [];
        }

        var rendered = [];
        var limit = Math.min(results.length, options.maxResults || MAX_RESULTS);
        for (var index = 0; index < limit; index++) {
            var data = await results[index].data();
            container.appendChild(renderItem(options.document, data));
            rendered.push(data);
        }
        return rendered;
    }

    /**
     * Wires the modal, the form and the result container. Returns false when
     * the host page does not carry the search surface (the adapter is inert).
     */
    function attach(options) {
        var doc = options.document;
        var modal = doc.getElementById(options.modalId || 'searchModal');
        var form = doc.getElementById(options.formId || 'pagefind-search-form');
        var container = doc.getElementById(options.resultsId || 'pagefind-results');
        if (!modal || !form || !container) return false;

        var input = form.querySelector('input[type="search"]');
        if (!input) return false;

        var loader = options.loadPagefind || loadDefault;
        var path = bundlePath(form, options.bundlePath);
        var pagefind = null;

        function ensure() {
            if (!pagefind) pagefind = loader(path);
            return pagefind;
        }

        function searchOnSubmit(event) {
            event.preventDefault();
            var query = input.value;
            ensure()
                .then(function (engine) {
                    return runSearch({
                        pagefind: engine,
                        query: query,
                        container: container,
                        document: doc,
                        emptyLabel: options.emptyLabel,
                    });
                })
                .catch(function () {
                    container.textContent = emptyLabel(container, options.emptyLabel);
                });
        }

        modal.addEventListener('show.bs.modal', function () {
            ensure().catch(function () {});
        });
        form.addEventListener('submit', searchOnSubmit);
        return true;
    }

    function bootstrap() {
        if (typeof document === 'undefined') return;
        function wire() {
            attach({ document: document });
        }
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', wire);
        } else {
            wire();
        }
    }

    bootstrap();

    return {
        attach: attach,
        bootstrap: bootstrap,
        bundlePath: bundlePath,
        importSpecifier: importSpecifier,
        resolveImportUrl: resolveImportUrl,
        emptyLabel: emptyLabel,
        normaliseQuery: normaliseQuery,
        renderItem: renderItem,
        runSearch: runSearch,
        DEFAULT_SCRIPT: DEFAULT_SCRIPT,
        MAX_RESULTS: MAX_RESULTS,
    };
}));
