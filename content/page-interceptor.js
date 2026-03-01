// manifest で world:"MAIN" + run_at:"document_start" で宣言。
// OBF の JS より先に実行することで fetch/XHR 両方を確実にインターセプト。
(function () {
  'use strict';

  if (window.__caseInterceptorInstalled) return;
  window.__caseInterceptorInstalled = true;

  function getPendingIds() {
    const el = document.getElementById('__case_pending__');
    if (!el) return [];
    return JSON.parse(el.getAttribute('data-ids') || '[]');
  }

  function clearPendingIds() {
    const el = document.getElementById('__case_pending__');
    if (el) el.setAttribute('data-ids', '[]');
  }

  function isBadgeSave(url, method) {
    return typeof url === 'string' &&
      /\/c\/badge\/.+\/edit/.test(url) &&
      method && method.toUpperCase() === 'POST';
  }

  function patchBody(bodyStr) {
    try {
      const ids = getPendingIds();
      if (ids.length === 0) return bodyStr;

      const body = JSON.parse(bodyStr);
      const lang = body.language || '';

      if (!body.alignment) body.alignment = {};

      const existing = body.alignment[lang];
      if (Array.isArray(existing)) {
        body.alignment[lang] = existing.concat(ids);
      } else if (existing && typeof existing === 'object' && Object.keys(existing).length > 0) {
        ids.forEach(id => { body.alignment[lang][id] = 1; });
      } else {
        body.alignment[lang] = ids;
      }

      clearPendingIds();
      return JSON.stringify(body);
    } catch (err) {
      console.error('[CASE] patchBody error:', err.message, bodyStr.slice(0, 200));
      return bodyStr;
    }
  }

  // ── Fetch API インターセプト ──
  const _origFetch = window.fetch.bind(window);
  window.fetch = function (url, options) {
    if (isBadgeSave(url, options && options.method)) {
      if (options && typeof options.body === 'string') {
        options = Object.assign({}, options, { body: patchBody(options.body) });
      }
    }
    return _origFetch(url, options);
  };

  // ── XHR インターセプト (jQuery $.ajax / Backbone.sync 対応) ──
  const _XHROpen = XMLHttpRequest.prototype.open;
  const _XHRSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url) {
    this._caseMethod = method;
    this._caseUrl = url;
    return _XHROpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function (body) {
    if (isBadgeSave(this._caseUrl, this._caseMethod) && typeof body === 'string') {
      body = patchBody(body);
    }
    return _XHRSend.call(this, body);
  };
})();
