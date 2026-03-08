(function () {
  'use strict';

  // ── i18n ───────────────────────────────────────────────────────
  const isJa = document.documentElement.lang?.startsWith('ja');
  const T = isJa ? {
    linkText:        'CASEから選択',
    modalTitle:      'CASEから選択',
    searchPlaceholder: 'キーワードで検索（日本語可）',
    searchBtn:       '検索',
    allTypes:        'すべて',
    loading:         '読み込み中...',
    detailPlaceholder: '左のリストから項目を選択してください',
    errorReload:     'エラー: 拡張機能を再読み込みしてください',
    loadFailed:      '読み込み失敗: ',
    noResults:       '該当する項目がありません',
    limitMsg:        n => `表示上限(${n}件)に達しました。検索で絞り込んでください。`,
    codeLabel:       'コード: ',
    typeLabel:       '種別: ',
    addToBadge:      'バッジに追加',
    checking:        '確認中...',
    registering:     '登録中...',
    csrfError:       'CSRFトークンの取得に失敗しました。ページを再読み込みしてください。',
    addFailed:       'アライメントの追加に失敗しました: ',
    idError:         'アライメントIDを取得できませんでした',
  } : {
    linkText:        'Pick from CASE',
    modalTitle:      'Pick from CASE',
    searchPlaceholder: 'Search by keyword',
    searchBtn:       'Search',
    allTypes:        'All',
    loading:         'Loading...',
    detailPlaceholder: 'Select an item from the list',
    errorReload:     'Error: please reload the extension',
    loadFailed:      'Load failed: ',
    noResults:       'No matching items',
    limitMsg:        n => `Showing first ${n} items. Use search to narrow results.`,
    codeLabel:       'Code: ',
    typeLabel:       'Type: ',
    addToBadge:      'Add to badge',
    checking:        'Checking...',
    registering:     'Registering...',
    csrfError:       'Failed to get CSRF token. Please reload the page.',
    addFailed:       'Failed to add alignment: ',
    idError:         'Could not get alignment ID',
  };

  // ── State ──────────────────────────────────────────────────────
  let caseData = null;
  let filteredItems = [];
  // CFItem.identifier → OBF alignment ID のセッション内キャッシュ（同セッション内の重複登録防止）
  const registeredCache = new Map();

  // ── Init ───────────────────────────────────────────────────────
  function init() {
    initBadgePage();
  }

  // ── Badge Edit Page ────────────────────────────────────────────
  function initBadgePage() {
    injectModal(); // モーダルは body に一度だけ注入

    // OBF がセクションを再描画するたびにリンクを再挿入する
    ensureCaseBadgeLink();
    new MutationObserver(ensureCaseBadgeLink)
      .observe(document.body, { childList: true, subtree: true });
    // MutationObserver のタイミング問題を補うポーリング
    setInterval(ensureCaseBadgeLink, 800);
  }

  function ensureCaseBadgeLink() {
    // すでに挿入済みなら何もしない
    if (document.getElementById('case-badge-link')) return;

    // 「ESCOから選択」を含むリンクを探す（表示中のもの優先）
    const allEscoLinks = Array.from(document.querySelectorAll('a'))
      .filter(a => a.textContent.includes('ESCO'));
    if (allEscoLinks.length === 0) return;

    // 表示されているリンクがあればそれを、なければ最初のものを使う
    const escoLink = allEscoLinks.find(a => a.offsetParent !== null) || allEscoLinks[0];

    // DOMノードを直接作成して挿入（insertAdjacentHTMLより確実）
    const sep = document.createTextNode(' | ');
    const link = document.createElement('a');
    link.href = '#';
    link.id = 'case-badge-link';
    link.style.color = '#e8763a';
    link.textContent = T.linkText;
    link.addEventListener('click', e => {
      e.preventDefault();
      openModal();
    });

    escoLink.parentNode.insertBefore(sep, escoLink.nextSibling);
    escoLink.parentNode.insertBefore(link, sep.nextSibling);
  }

  // ── DOM ベースの pending ID 管理（content script 側）────────────
  // content script と injected script は同じ DOM を共有するため、
  // data 属性を介した通信は確実に動作する
  function getPendingEl() {
    let el = document.getElementById('__case_pending__');
    if (!el) {
      el = document.createElement('meta');
      el.id = '__case_pending__';
      document.head.appendChild(el);
    }
    return el;
  }

  function addPendingAlignmentId(id) {
    const el = getPendingEl();
    const ids = JSON.parse(el.getAttribute('data-ids') || '[]');
    if (!ids.includes(id)) ids.push(id);
    el.setAttribute('data-ids', JSON.stringify(ids));
  }

  function removePendingAlignmentId(id) {
    const el = document.getElementById('__case_pending__');
    if (!el) return;
    const ids = JSON.parse(el.getAttribute('data-ids') || '[]').filter(x => x !== id);
    el.setAttribute('data-ids', JSON.stringify(ids));
  }

  // ── Modal HTML ─────────────────────────────────────────────────
  function injectModal() {
    if (document.getElementById('case-picker-overlay')) return;

    document.body.insertAdjacentHTML('beforeend', `
      <div id="case-picker-overlay" class="case-overlay">
        <div class="case-modal">

          <div class="case-modal-header">
            <span class="case-modal-title">${T.modalTitle}</span>
            <button id="case-close-btn" class="case-modal-close" type="button">×</button>
          </div>

          <div class="case-modal-body">
            <div class="case-search-row">
              <input id="case-search-input" class="case-search-input"
                     type="text" placeholder="${T.searchPlaceholder}">
              <button id="case-search-btn" class="case-search-btn" type="button">${T.searchBtn}</button>
            </div>
            <div id="case-type-filters" class="case-type-filters"></div>
            <div class="case-two-pane">
              <div class="case-list-pane">
                <div id="case-list" class="case-list">
                  <div class="case-status-msg">${T.loading}</div>
                </div>
              </div>
              <div id="case-detail-pane" class="case-detail-pane">
                <div class="case-detail-placeholder">${T.detailPlaceholder}</div>
              </div>
            </div>
          </div>

        </div>
      </div>
    `);

    document.getElementById('case-close-btn').addEventListener('click', closeModal);
    document.getElementById('case-picker-overlay').addEventListener('click', e => {
      if (e.target.id === 'case-picker-overlay') closeModal();
    });
    document.getElementById('case-search-btn').addEventListener('click', doSearch);
    document.getElementById('case-search-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') doSearch();
    });
  }

  // ── Open / Close Modal ─────────────────────────────────────────
  function openModal() {
    document.getElementById('case-picker-overlay').classList.add('is-open');
    document.body.style.overflow = 'hidden';

    document.getElementById('case-detail-pane').innerHTML =
      `<div class="case-detail-placeholder">${T.detailPlaceholder}</div>`;

    if (caseData) {
      renderTypeFilters(caseData.items);
      renderList(caseData.items);
    } else {
      setListMessage(T.loading);
      chrome.runtime.sendMessage({ action: 'fetchCASE' }, response => {
        if (chrome.runtime.lastError) {
          setListMessage(T.errorReload);
          return;
        }
        if (response?.success) {
          caseData = response.data;
          renderTypeFilters(caseData.items);
          renderList(caseData.items);
        } else {
          setListMessage(T.loadFailed + (response?.error || '?'));
        }
      });
    }
  }

  function closeModal() {
    document.getElementById('case-picker-overlay').classList.remove('is-open');
    document.body.style.overflow = '';
    document.getElementById('case-search-input').value = '';
    document.querySelectorAll('.case-type-btn').forEach(b => b.classList.remove('active'));
    const allBtn = document.querySelector('.case-type-btn[data-type=""]');
    if (allBtn) allBtn.classList.add('active');
    activeTypeFilter = null;
  }

  function setListMessage(msg) {
    document.getElementById('case-list').innerHTML =
      `<div class="case-status-msg">${escHtml(msg)}</div>`;
  }

  // ── Type Filters ───────────────────────────────────────────────
  let activeTypeFilter = null;

  function renderTypeFilters(items) {
    const types = [...new Set(items.map(i => i.CFItemType).filter(Boolean))];
    const container = document.getElementById('case-type-filters');
    container.innerHTML =
      `<button class="case-type-btn active" type="button" data-type="">${T.allTypes}</button>` +
      types.map(t =>
        `<button class="case-type-btn" type="button" data-type="${escHtml(t)}">${escHtml(t)}</button>`
      ).join('');

    container.querySelectorAll('.case-type-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.case-type-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeTypeFilter = btn.dataset.type || null;
        doSearch();
      });
    });
  }

  // ── Search ─────────────────────────────────────────────────────
  function doSearch() {
    if (!caseData) return;
    const kw = document.getElementById('case-search-input').value.trim().toLowerCase();
    let items = caseData.items;
    if (kw) {
      items = items.filter(item =>
        (item.fullStatement || '').toLowerCase().includes(kw) ||
        (item.humanCodingScheme || '').toLowerCase().includes(kw)
      );
    }
    if (activeTypeFilter) {
      items = items.filter(item => item.CFItemType === activeTypeFilter);
    }
    renderList(items);
  }

  // ── List Rendering ─────────────────────────────────────────────
  function renderList(items) {
    filteredItems = items;
    const list = document.getElementById('case-list');

    if (items.length === 0) {
      list.innerHTML = `<div class="case-status-msg">${T.noResults}</div>`;
      return;
    }

    const LIMIT = 300;
    const rows = items.slice(0, LIMIT).map((item, idx) => {
      const badge = item.CFItemType
        ? `<span class="case-type-badge">${escHtml(item.CFItemType)}</span>`
        : '';
      return `
        <div class="case-list-item" data-idx="${idx}">
          <span class="case-item-label">${escHtml(item.fullStatement || '')}</span>
          ${badge}
        </div>`;
    }).join('');

    list.innerHTML = rows +
      (items.length > LIMIT
        ? `<div class="case-status-msg">${escHtml(T.limitMsg(LIMIT))}</div>`
        : '');

    list.querySelectorAll('.case-list-item').forEach(el => {
      el.addEventListener('click', () => {
        list.querySelectorAll('.case-list-item').forEach(r => r.classList.remove('active'));
        el.classList.add('active');
        showDetail(filteredItems[parseInt(el.dataset.idx)]);
      });
    });
  }

  // ── Detail Pane ────────────────────────────────────────────────
  function showDetail(item) {
    const pane = document.getElementById('case-detail-pane');

    pane.innerHTML = `
      <div class="case-detail-content">
        <h4 class="case-detail-title">${escHtml(item.fullStatement || '')}</h4>
        <a href="${escHtml(itemUrl(item))}" class="case-detail-url" target="_blank" rel="noopener">
          ${escHtml(itemUrl(item))}
        </a>
        ${item.humanCodingScheme
          ? `<p class="case-detail-meta">${T.codeLabel}${escHtml(item.humanCodingScheme)}</p>`
          : ''}
        ${item.CFItemType
          ? `<p class="case-detail-meta">${T.typeLabel}${escHtml(item.CFItemType)}</p>`
          : ''}
        ${item.notes
          ? `<p class="case-detail-notes">${escHtml(item.notes)}</p>`
          : ''}
        <button class="case-select-btn" id="case-select-btn" type="button">${T.addToBadge}</button>
      </div>
    `;

    document.getElementById('case-select-btn').addEventListener('click', () => {
      registerAndAddToBadge(item);
    });
  }

  // ── OBF の既存アライメントを URL で検索（2段階）────────────────
  // 1. グリッドAPI（NDJSON）で名前絞り込み → 2. 編集ページで URL 照合
  async function findAlignmentByUrl(targetUrl, itemName) {
    try {
      // Step 1: グリッドAPIから全件取得して名前が一致する候補を抽出
      const res = await fetch('/c/grid/list/alignment?_=' + Date.now(), { credentials: 'include' });
      const text = await res.text();
      const candidates = text.trim().split('\n')
        .filter(Boolean)
        .map(line => { try { return JSON.parse(line); } catch { return null; } })
        .filter(obj => obj && obj.name === itemName);

      if (candidates.length === 0) return null;

      // Step 2: 候補の編集ページから URL フィールドを確認
      for (const candidate of candidates) {
        const editRes = await fetch(`/c/alignment/${candidate.id}/edit`, { credentials: 'include' });
        const html = await editRes.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const urlInput = doc.querySelector('input[name="url"]');
        if (urlInput?.value === targetUrl) return candidate.id;
      }
    } catch (_) {}
    return null;
  }

  // ── Badge Mode: アライメントを登録してバッジに追加 ──────────────
  async function registerAndAddToBadge(item) {
    const url = itemUrl(item);
    const btn = document.getElementById('case-select-btn');
    if (btn) { btn.disabled = true; btn.textContent = T.checking; }

    try {
      let alignmentId;

      // 1. セッション内キャッシュを確認（同じページで既に処理済み）
      if (registeredCache.has(item.identifier)) {
        alignmentId = registeredCache.get(item.identifier);

      } else {
        // 2. OBF サーバーに同じ URL のアライメントが既に存在するか検索
        alignmentId = await findAlignmentByUrl(url, item.fullStatement || '');

        if (!alignmentId) {
          // 3. 存在しなければ新規作成
          if (btn) btn.textContent = T.registering;
          const csrf = await getCSRFToken();
          if (!csrf) {
            alert(T.csrfError);
            if (btn) { btn.disabled = false; btn.textContent = T.addToBadge; }
            return;
          }

          const body = new URLSearchParams({
            csrftoken:   csrf,
            framework:   '',
            code:        '',
            name:        item.fullStatement || '',
            url:         url,
            description: item.notes || '',
            replace:     '保存'
          });

          const res = await fetch('/c/alignment/new', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString(),
            credentials: 'include'
          });

          alignmentId = new URL(res.url).searchParams.get('saved');
          if (!alignmentId) throw new Error(T.idError);
        }

        registeredCache.set(item.identifier, alignmentId);
      }

      addPendingAlignmentId(alignmentId);
      addAlignmentLi(item.fullStatement || '', alignmentId);
      closeModal();

    } catch (err) {
      alert(T.addFailed + err.message);
      if (btn) { btn.disabled = false; btn.textContent = T.addToBadge; }
    }
  }

  function addAlignmentLi(name, alignmentId) {
    const ul = document.querySelector('ul.list-group');
    if (!ul) return;

    const li = document.createElement('li');
    li.className = 'list-group-item';
    li.dataset.caseAlignmentId = alignmentId;
    li.innerHTML = `
      <button class="btn btn-link" disabled
              style="padding:0px 2px; color:rgb(127,113,121);">
        <span class="glyphicon glyphicon-arrow-up"></span>
      </button>
      <button class="btn btn-link" disabled
              style="padding:0px 2px; color:rgb(127,113,121); margin-right:10px;">
        <span class="glyphicon glyphicon-arrow-down"></span>
      </button>
      ${escHtml(name)}
      <button class="btn btn-link pull-right case-remove-alignment" type="button">
        <span class="glyphicon glyphicon-trash"></span>
      </button>
    `;

    li.querySelector('.case-remove-alignment').addEventListener('click', () => {
      removePendingAlignmentId(alignmentId);
      li.remove();
    });

    ul.appendChild(li);
  }

  // ── CSRF Token ─────────────────────────────────────────────────
  async function getCSRFToken() {
    const el = document.querySelector('input[name="csrftoken"]');
    if (el?.value) return el.value;

    try {
      const res = await fetch('/c/alignment/new', { credentials: 'include' });
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      return doc.querySelector('input[name="csrftoken"]')?.value || null;
    } catch {
      return null;
    }
  }

  // ── CASE Item URL ──────────────────────────────────────────────
  function itemUrl(item) {
    return `https://opensalt.net/uri/${item.identifier}`;
  }

  // ── Utilities ──────────────────────────────────────────────────
  function escHtml(str) {
    const d = document.createElement('div');
    d.textContent = String(str);
    return d.innerHTML;
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ── Start ──────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
