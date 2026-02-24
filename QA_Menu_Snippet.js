(() => {
  // ═══════════════════════════════════════════════════════════════════════════
  // 🧪 QA Menu V0.3 - Refatorado com Exports & Relatórios
  // Ferramentas de QA, Performance, Segurança & Acessibilidade
  // ═══════════════════════════════════════════════════════════════════════════
  // Rodar: DevTools → Sources → Snippets → Ctrl+Enter
  // Nota: Executa no contexto da página (não altera configs do DevTools)
  // ═══════════════════════════════════════════════════════════════════════════

  // ─────────────────────────────────────────────────────────────────────────
  // 🎯 CONFIGURAÇÃO CENTRALIZADA - Tudo em um lugar
  // ─────────────────────────────────────────────────────────────────────────
  const CONFIG = {
    STORAGE_KEY: 'qaMenuSettingsV51',
    AUDIT_REPORTS: 'qaAuditReportsV51',
    UI: {
      HEADER: '🧪 QA MENU V0.3',
      MAX_WIDTH: '420px',
      MAX_HEIGHT: '72vh',
      Z_INDEX: '2147483647',
    },
    MARK_COLORS: {
      ORPHAN: '#ff00ff',      // magenta
      UNLABELED: '#2196f3',   // azul
      INVISIBLE: '#ff9800',   // laranja
      NO_NAME: '#00bcd4',     // ciano
    },
    LIMITS: {
      ORPHAN_H_DIST: 500,
      ORPHAN__V_TOL: 60,
      LONG_TASK_THRESHOLD: 50,
    },
    PATTERNS: {
      JWT: /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/,
      URL_PROTOCOL: /^https?:/i,
      INPUT_TYPES: /^(text|search|url|email|tel|number|password)?$/i,
    },
  };

  // ─────────────────────────────────────────────────────────────────────────
  // 🔄 ESTADO GLOBAL - Organizado e Intuitivo
  // ─────────────────────────────────────────────────────────────────────────
  const STATE = {
    original: {
      fetch: window.fetch,
      XHR: window.XMLHttpRequest,
      eval: window.eval,
      Function: window.Function,
    },
    network: {
      patched: false,
      offline: false,
      delay: 0,
      failRx: [],
    },
    monitors: {
      fps_raf: 0,
      sinks: false,
      csp: false,
      evalMonitor: false,
    },
    observers: [],
    targetElement: null,
    uxSection: null,
    markedElements: [],
    snapshots: new Map(),
    auditReports: [],
    lastAuditTime: null,
    settings: JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY)) || { delay: 0, failRx: [] }
  };

  STATE.network.delay = STATE.settings.delay;
  STATE.network.failRx = STATE.settings.failRx.map(rxStr => new RegExp(rxStr));
  
  // Carregar reports salvos
  try {
    const savedReports = localStorage.getItem(CONFIG.AUDIT_REPORTS);
    STATE.auditReports = savedReports ? JSON.parse(savedReports) : [];
  } catch (e) {
    STATE.auditReports = [];
  }

  function saveSettings() {
    localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify({
      delay: STATE.network.delay,
      failRx: STATE.network.failRx.map(r => r.source)
    }));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 🏗️ CONSTRUÇÃO DO HUD
  // ─────────────────────────────────────────────────────────────────────────
  const HUD_HOST = document.createElement('div');
  HUD_HOST.id = '__qaHudHostV51';
  Object.assign(HUD_HOST.style, {
    position: 'fixed',
    right: '12px',
    top: '12px',
    zIndex: CONFIG.UI.Z_INDEX
  });

  const SHADOW = HUD_HOST.attachShadow({ mode: 'open' });
  document.documentElement.appendChild(HUD_HOST);

  // ─────────────────────────────────────────────────────────────────────────
  // 🎨 ESTILOS
  // ─────────────────────────────────────────────────────────────────────────
  const STYLESHEET = document.createElement('style');
  STYLESHEET.textContent = `
    @keyframes slideIn { from { opacity: 0; transform: translate(20px, -20px); } to { opacity: 1; transform: translate(0,0); } }
    :host {
      all: initial;
      font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif;
      font-size: 12px;
      line-height: 1.5;
      color: #e0e0e0;
    }
    .qa-box {
      width: 420px;
      background: linear-gradient(135deg, #0f0f0f 0%, #1a1a1a 100%);
      color: #e0e0e0;
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 14px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05);
      overflow: hidden;
      animation: slideIn 0.3s ease-out;
    }
    .qa-header {
      padding: 12px 14px;
      background: linear-gradient(90deg, rgba(76,175,80,0.1) 0%, rgba(179,157,219,0.1) 100%);
      border-bottom: 1px solid rgba(255,255,255,0.08);
      font-weight: 700;
      letter-spacing: 0.6px;
      cursor: move;
      user-select: none;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .qa-header-title {
      flex: 1;
      cursor: move;
    }
    .qa-header-controls {
      display: flex;
      gap: 4px;
      align-items: center;
    }
    .qa-control-btn {
      background: rgba(255,255,255,0.1);
      color: #e0e0e0;
      border: 1px solid rgba(255,255,255,0.2);
      width: 28px;
      height: 28px;
      padding: 0;
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      transition: all 0.2s ease;
      user-select: none;
    }
    .qa-control-btn:hover {
      background: rgba(255,255,255,0.2);
      border-color: rgba(255,255,255,0.4);
      transform: scale(1.1);
    }
    .qa-control-btn:active { transform: scale(0.95); }
    .qa-box.minimized {
      width: 420px !important;
    }
    .qa-box.minimized .qa-body {
      display: none;
    }
    .qa-box.minimized .qa-header {
      border-bottom: none;
    }
    .qa-body {
      padding: 12px;
      max-height: 72vh;
      overflow-y: auto;
      overflow-x: hidden;
    }
    .qa-body::-webkit-scrollbar { width: 6px; }
    .qa-body::-webkit-scrollbar-track { background: rgba(255,255,255,0.05); border-radius: 10px; }
    .qa-body::-webkit-scrollbar-thumb { background: rgba(76,175,80,0.3); border-radius: 10px; }
    .qa-body::-webkit-scrollbar-thumb:hover { background: rgba(76,175,80,0.5); }
    .qa-section { margin-bottom: 12px; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
    .qa-section:last-child { border-bottom: none; }
    .qa-section h4 {
      margin: 0 0 8px;
      font-size: 12px;
      font-weight: 700;
      background: linear-gradient(90deg, #b39ddb, #7c4dff);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      letter-spacing: 0.4px;
      text-transform: uppercase;
    }
    .qa-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 8px;
    }
    .qa-btn {
      background: linear-gradient(135deg, #222 0%, #1a1a1a 100%);
      color: #e0e0e0;
      border: 1px solid rgba(255,255,255,0.15);
      padding: 7px 10px;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      font-size: 11px;
      font-weight: 600;
      white-space: nowrap;
      user-select: none;
    }
    .qa-btn:hover {
      background: linear-gradient(135deg, #2d2d2d 0%, #222 100%);
      border-color: rgba(255,255,255,0.3);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    }
    .qa-btn:active { transform: translateY(0); }
    .qa-btn.active {
      background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
      border-color: #4CAF50;
      color: #fff;
      box-shadow: 0 0 16px rgba(76, 175, 80, 0.4), inset 0 1px 0 rgba(255,255,255,0.2);
    }
    .qa-input {
      background: rgba(255,255,255,0.05);
      color: #e0e0e0;
      border: 1px solid rgba(255,255,255,0.15);
      padding: 6px 8px;
      border-radius: 8px;
      font-size: 11px;
      transition: all 0.2s ease;
      font-family: Monaco, Menlo, monospace;
    }
    .qa-input:focus {
      outline: none;
      border-color: #b39ddb;
      box-shadow: 0 0 8px rgba(179, 157, 219, 0.3), inset 0 0 4px rgba(179, 157, 219, 0.1);
      background: rgba(179, 157, 219, 0.05);
    }
    .qa-input::placeholder { color: rgba(224, 224, 224, 0.4); }
    .qa-label {
      display: flex;
      align-items: center;
      gap: 6px;
      color: #bbb;
      font-size: 11px;
      font-weight: 500;
    }
    .qa-hint {
      color: #888;
      display: block;
      margin-top: 6px;
      font-size: 10px;
      font-style: italic;
      line-height: 1.4;
      padding: 4px 0;
      border-left: 2px solid rgba(255,255,255,0.1);
      padding-left: 6px;
    }
    .qa-divider { height: 1px; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent); margin: 8px 0; }
    .qa-toast-container {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 2147483647;
      display: flex;
      flex-direction: column;
      gap: 10px;
      pointer-events: none;
    }
    .qa-toast {
      background: linear-gradient(135deg, rgba(0,0,0,0.95) 0%, rgba(20,20,20,0.95) 100%);
      color: #fff;
      padding: 12px 16px;
      border-radius: 8px;
      border-left: 4px solid #4CAF50;
      box-shadow: 0 8px 24px rgba(0,0,0,0.4);
      opacity: 0;
      transition: opacity 0.3s ease-in-out, transform 0.3s ease-in-out;
      min-width: 240px;
      text-align: center;
      transform: translateY(20px);
      font-weight: 500;
    }
    .qa-toast.show {
      opacity: 1;
      transform: translateY(0);
    }
    .qa-toast.error { border-left-color: #f44336; }
    .qa-toast.warning { border-left-color: #ff9800; }
    .qa-toast.info { border-left-color: #2196f3; }
    .qa-toast.success { border-left-color: #4CAF50; }
  `;
  SHADOW.appendChild(STYLESHEET);

  // ─────────────────────────────────────────────────────────────────────────
  // 🛠️ UI FACTORY - Builders Mais Legíveis
  // ─────────────────────────────────────────────────────────────────────────
  const UIFactory = {
    section: (title) => {
      const section = document.createElement('section');
      section.className = 'qa-section';
      const h4 = document.createElement('h4');
      h4.textContent = title;
      section.append(h4);
      return section;
    },
    row: () => {
      const row = document.createElement('div');
      row.className = 'qa-row';
      return row;
    },
    button: (text, clickHandler, className = '') => {
      const btn = document.createElement('button');
      btn.textContent = text;
      btn.className = 'qa-btn ' + className;
      btn.onclick = clickHandler;
      return btn;
    },
    input: (type, value = '', width = 'auto') => {
      const inp = document.createElement('input');
      inp.type = type;
      inp.value = value;
      inp.className = 'qa-input';
      if (width !== 'auto') Object.assign(inp.style, { width });
      return inp;
    },
    label: (text, element) => {
      const lbl = document.createElement('label');
      lbl.className = 'qa-label';
      lbl.append(text, element);
      return lbl;
    },
    hint: (text) => {
      const small = document.createElement('small');
      small.textContent = text;
      small.className = 'qa-hint';
      return small;
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // 📦 Construção da Interface
  // ─────────────────────────────────────────────────────────────────────────
  const BOX = document.createElement('div');
  BOX.className = 'qa-box';
  
  const HEADER = document.createElement('div');
  HEADER.className = 'qa-header';
  
  const HEADER_TITLE = document.createElement('div');
  HEADER_TITLE.className = 'qa-header-title';
  HEADER_TITLE.textContent = CONFIG.UI.HEADER;
  
  const HEADER_CONTROLS = document.createElement('div');
  HEADER_CONTROLS.className = 'qa-header-controls';
  
  const btnMinimize = document.createElement('button');
  btnMinimize.className = 'qa-control-btn';
  btnMinimize.textContent = '−';
  btnMinimize.title = 'Minimizar';
  
  const btnClose = document.createElement('button');
  btnClose.className = 'qa-control-btn';
  btnClose.textContent = '✕';
  btnClose.title = 'Fechar';
  
  HEADER_CONTROLS.append(btnMinimize, btnClose);
  HEADER.append(HEADER_TITLE, HEADER_CONTROLS);
  
  const BODY = document.createElement('div');
  BODY.className = 'qa-body';

  SHADOW.appendChild(BOX);
  BOX.append(HEADER, BODY);

  const TOAST_CONTAINER = document.createElement('div');
  TOAST_CONTAINER.className = 'qa-toast-container';
  SHADOW.appendChild(TOAST_CONTAINER);

  // ═════════════════════════════════════════════════════════════════════════
  // 🎛️ CONTROLES DO MENU (Minimize, Maximize, Close)
  // ═════════════════════════════════════════════════════════════════════════
  STATE.menuMinimized = localStorage.getItem('qaMenuMinimized') === 'true' || false;
  if (STATE.menuMinimized) BOX.classList.add('minimized');
  
  function toggleMinimize() {
    STATE.menuMinimized = !STATE.menuMinimized;
    BOX.classList.toggle('minimized', STATE.menuMinimized);
    btnMinimize.textContent = STATE.menuMinimized ? '▲' : '−';
    btnMinimize.title = STATE.menuMinimized ? 'Restaurar' : 'Minimizar';
    localStorage.setItem('qaMenuMinimized', STATE.menuMinimized);
  }
  
  function closeMenu() {
    if (confirm('Tem certeza que deseja fechar o QA Menu?')) {
      HUD_HOST.style.display = 'none';
      localStorage.setItem('qaMenuClosed', 'true');
      console.log('[QA V0.3] Menu fechado. Execute: localStorage.removeItem("qaMenuClosed"); location.reload();');
    }
  }
  
  btnMinimize.onclick = (e) => { e.stopPropagation(); toggleMinimize(); };
  btnClose.onclick = (e) => { e.stopPropagation(); closeMenu(); };
  
  // Verificar se menu estava fechado
  if (localStorage.getItem('qaMenuClosed') === 'true') {
    HUD_HOST.style.display = 'none';
  }

  function showToast(message, duration = 3000, type = 'success') {
    const toast = document.createElement('div');
    toast.className = 'qa-toast ' + type;
    toast.textContent = message;
    TOAST_CONTAINER.appendChild(toast);
    void toast.offsetWidth;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
      toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    }, duration);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 🖱️ DRAG & DROP do HUD
  // ─────────────────────────────────────────────────────────────────────────
  const DragManager = {
    isDragging: false,
    offsetX: 0,
    offsetY: 0,
    onMouseDown(e) {
      DragManager.isDragging = true;
      const rect = HUD_HOST.getBoundingClientRect();
      DragManager.offsetX = e.clientX - rect.left;
      DragManager.offsetY = e.clientY - rect.top;
      HUD_HOST.style.cursor = 'grabbing';
    },
    onMouseMove(e) {
      if (!DragManager.isDragging) return;
      HUD_HOST.style.left = (e.clientX - DragManager.offsetX) + 'px';
      HUD_HOST.style.top = (e.clientY - DragManager.offsetY) + 'px';
      HUD_HOST.style.right = 'auto';
      HUD_HOST.style.bottom = 'auto';
    },
    onMouseUp() {
      DragManager.isDragging = false;
      HUD_HOST.style.cursor = 'grab';
    }
  };

  HEADER_TITLE.addEventListener('mousedown', DragManager.onMouseDown);
  document.addEventListener('mousemove', DragManager.onMouseMove);
  document.addEventListener('mouseup', DragManager.onMouseUp);

  // ─────────────────────────────────────────────────────────────────────────
  // 🛠️ UTILITIES - Funções Reutilizáveis (DOM)
  // ─────────────────────────────────────────────────────────────────────────
  const DOM = {
    forEachIframe(callback) {
      document.querySelectorAll('iframe').forEach(iframe => {
        try {
          callback(iframe.contentWindow.document);
        } catch (e) {
          console.warn('[QA] Iframe CORS:', iframe.src);
        }
      });
    },
    getAllInputs() {
      let inputs = Array.from(document.querySelectorAll('input, textarea, select'));
      DOM.forEachIframe(doc => {
        inputs = inputs.concat(Array.from(doc.querySelectorAll('input, textarea, select')));
      });
      return inputs;
    },
    setInputValue(el, value) {
      el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    },
    getAccessibleName(el) {
      if (el.labels?.length > 0) return el.labels[0].textContent.trim();
      if (el.placeholder) return el.placeholder.trim();
      if (el.title) return el.title.trim();
      if (el.getAttribute('aria-label')) return el.getAttribute('aria-label').trim();
      if (el.id) {
        const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
        if (label) return label.textContent.trim();
      }
      return '';
    },
    isVisible(el) {
      return el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0;
    },
    isFocusable(el) {
      if (el.tabIndex > 0 || (el.tabIndex === 0 && el.getAttribute('tabIndex') !== null)) return true;
      if (el.disabled) return false;
      const tag = el.tagName;
      return tag === 'A' || tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || tag === 'BUTTON';
    }
  };

  function markElement(el, color) {
    el.__qaOldOutline = el.style.outline;
    el.style.outline = `2px solid ${color}`;
    STATE.markedElements.push(el);
  }

  function clearAllMarks() {
    STATE.markedElements.forEach(el => {
      if (el.__qaOldOutline !== undefined) {
        el.style.outline = el.__qaOldOutline;
        delete el.__qaOldOutline;
      }
    });
    STATE.markedElements = [];
  }

  function findControlsNear(sectionEl, opts = {}) {
    const { hDist = CONFIG.LIMITS.ORPHAN_H_DIST, vTol = CONFIG.LIMITS.ORPHAN__V_TOL } = opts;
    const sectionRect = sectionEl.getBoundingClientRect();
    return Array.from(document.querySelectorAll('input, textarea, select, button, a[href], [tabindex]'))
      .filter(DOM.isVisible)
      .filter(ctrl => {
        const ctrlRect = ctrl.getBoundingClientRect();
        const hDist_actual = Math.abs(sectionRect.left - ctrlRect.left);
        const vDist = Math.abs(sectionRect.top - ctrlRect.top);
        return hDist_actual < hDist && vDist < vTol;
      });
  }

  function looksLikeHeading(el) {
    const cs = getComputedStyle(el);
    const fontSize = parseFloat(cs.fontSize);
    const fontWeight = parseInt(cs.fontWeight);
    return (fontSize > 16 && fontWeight >= 500) || fontSize > 20;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 📋 SEÇÕES DE FUNCIONALIDADES
  // ═══════════════════════════════════════════════════════════════════════════

  // 🟦 UI
  const secUI = UIFactory.section('🟦 UI');
  const rUI1 = UIFactory.row();
  const outlineBtn = UIFactory.button('Outline', () => {
    document.documentElement.classList.toggle('__qaOutlineV51');
    outlineBtn.classList.toggle('active', document.documentElement.classList.contains('__qaOutlineV51'));
    showToast(`Outline: ${document.documentElement.classList.contains('__qaOutlineV51') ? 'ON' : 'OFF'}`);
  });
  rUI1.append(
    outlineBtn,
    UIFactory.button('Inspecionar clique', () => {
      showToast('Clique no elemento...');
      const once = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (typeof inspect === 'function') inspect(e.target);
        document.removeEventListener('click', once, true);
      };
      document.addEventListener('click', once, true);
    })
  );
  secUI.append(rUI1);

  const outlineStyle = document.createElement('style');
  outlineStyle.id = '__qaOutlineStyleV51';
  outlineStyle.textContent = `.__qaOutlineV51 * { outline:1px dashed rgba(255,255,255,.25) !important; }`;
  document.documentElement.appendChild(outlineStyle);

  // 🟩 API/Network
  const secAPI = UIFactory.section('🟩 API');
  const rAPI1 = UIFactory.row();
  const delayInput = UIFactory.input('number', STATE.network.delay.toString(), '90px');
  delayInput.min = '0';
  delayInput.step = '100';
  delayInput.oninput = () => {
    STATE.network.delay = Math.max(0, Number(delayInput.value) || 0);
    saveSettings();
    showToast(`Atraso: ${STATE.network.delay}ms`);
  };

  const patchNetworkBtn = UIFactory.button('Ativar/Desativar patch', () => {
    patchNetwork();
    patchNetworkBtn.classList.toggle('active', STATE.network.patched);
    showToast(`Patch de rede: ${STATE.network.patched ? 'ATIVO' : 'DESATIVADO'}`);
  });
  const offlineBtn = UIFactory.button('Offline', () => {
    if (!STATE.network.patched) patchNetwork();
    STATE.network.offline = !STATE.network.offline;
    offlineBtn.classList.toggle('active', STATE.network.offline);
    showToast(`Offline: ${STATE.network.offline ? 'ON' : 'OFF'}`);
  });

  rAPI1.append(patchNetworkBtn, offlineBtn);
  const rAPI2 = UIFactory.row();
  rAPI2.append(
    UIFactory.button('+ Falha (regex)', () => {
      const rxStr = prompt('Regex de URL (ex.: ^/api/)');
      if (!rxStr) return;
      try {
        const newRx = new RegExp(rxStr);
        STATE.network.failRx.push(newRx);
        saveSettings();
        showToast(`Regra adicionada: ${rxStr}`);
      } catch (e) {
        showToast(`Regex inválido: ${e.message}`, 3000, 'error');
      }
    }),
    UIFactory.button('Limpar', () => {
      STATE.network.failRx = [];
      saveSettings();
      showToast('Regras limpas');
    }),
    UIFactory.label('Atraso (ms):', delayInput)
  );
  secAPI.append(rAPI1, rAPI2);

  // ⚙️ Network Patching
  function patchNetwork() {
    if (STATE.network.patched) {
      window.fetch = STATE.original.fetch;
      window.XMLHttpRequest = STATE.original.XHR;
      STATE.network.patched = false;
      return;
    }

    window.fetch = async function (...args) {
      const url = args[0] instanceof Request ? args[0].url : args[0];
      if (STATE.network.offline) throw new TypeError('Failed to fetch (offline)');
      if (STATE.network.failRx.some(rx => rx.test(url))) throw new TypeError('Failed to fetch (simulated)');
      if (STATE.network.delay > 0) await new Promise(r => setTimeout(r, STATE.network.delay));
      return STATE.original.fetch(...args);
    };

    window.XMLHttpRequest = function () {
      const xhr = new STATE.original.XHR();
      const originalOpen = xhr.open;
      const originalSend = xhr.send;

      xhr.open = function (method, url) {
        this._url = url;
        return originalOpen.apply(this, arguments);
      };

      xhr.send = function (...args) {
        if (STATE.network.offline || STATE.network.failRx.some(rx => rx.test(this._url))) {
          this.dispatchEvent(new Event('error'));
          this.status = 0;
          this.readyState = 4;
          this.responseText = '';
          if (this.onerror) this.onerror();
          return;
        }
        if (STATE.network.delay > 0) {
          setTimeout(() => originalSend.apply(this, args), STATE.network.delay);
        } else {
          originalSend.apply(this, args);
        }
      };
      return xhr;
    };
    STATE.network.patched = true;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 🟧 SEÇÃO PERFORMANCE
  // ─────────────────────────────────────────────────────────────────────────
  const secPerf = UIFactory.section('🟧 Performance');
  const rPerf = UIFactory.row();
  const fpsBtn = UIFactory.button('FPS', () => toggleFPS());
  const clsBtn = UIFactory.button('CLS', () => toggleCLS());
  const longTasksBtn = UIFactory.button('Long Tasks', () => toggleLongTasks());
  rPerf.append(fpsBtn, clsBtn, longTasksBtn, UIFactory.button('Congelar UI 3s', () => freezeUI(3000)));
  secPerf.append(rPerf);

  const PerformanceMonitor = {
    create(id, label, color) {
      const el = document.createElement('div');
      el.id = id;
      Object.assign(el.style, { position: 'fixed', top: id === '__qaFpsV51' ? '10px' : id === '__qaClsV51' ? '40px' : '70px', left: '10px', zIndex: CONFIG.UI.Z_INDEX, background: 'rgba(0,0,0,0.7)', color, padding: '4px 8px', borderRadius: '4px', fontSize: '10px', fontFamily: 'monospace', fontWeight: 'bold' });
      el.textContent = `${label}: --`;
      document.body.appendChild(el);
      return el;
    },
    remove(id) {
      STATE.observers = STATE.observers.filter(o => { if (o.id === id) { o.disconnect(); return false; } return true; });
      document.getElementById(id)?.remove();
    }
  };

  function toggleFPS() {
    const id = '__qaFpsV51';
    if (document.getElementById(id)) {
      document.getElementById(id).remove(); fpsBtn.classList.remove('active'); cancelAnimationFrame(STATE.monitors.fps_raf); showToast('FPS Monitor: OFF'); return;
    }
    const el = PerformanceMonitor.create(id, 'FPS', 'lime');
    fpsBtn.classList.add('active'); showToast('FPS Monitor: ON');
    let frames = 0, lastTime = performance.now();
    function updateFPS() { frames++; const now = performance.now(); if (now > lastTime + 1000) { el.textContent = `FPS: ${Math.round((frames * 1000) / (now - lastTime))}`; frames = 0; lastTime = now; } STATE.monitors.fps_raf = requestAnimationFrame(updateFPS); }
    STATE.monitors.fps_raf = requestAnimationFrame(updateFPS);
  }

  function toggleCLS() {
    const id = '__qaClsV51';
    if (document.getElementById(id)) { PerformanceMonitor.remove(id); clsBtn.classList.remove('active'); showToast('CLS Monitor: OFF'); return; }
    const el = PerformanceMonitor.create(id, 'CLS', 'yellow');
    clsBtn.classList.add('active'); showToast('CLS Monitor: ON');
    let cls = 0;
    const observer = new PerformanceObserver(entryList => { for (const entry of entryList.getEntries()) { if (!entry.hadRecentInput) { cls += entry.value; el.textContent = `CLS: ${cls.toFixed(4)}`; } } });
    observer.observe({ type: 'layout-shift', buffered: true }); observer.id = id; STATE.observers.push(observer); el.textContent = `CLS: ${cls.toFixed(4)}`;
  }

  function toggleLongTasks() {
    const id = '__qaLongTasksV51';
    if (document.getElementById(id)) { PerformanceMonitor.remove(id); longTasksBtn.classList.remove('active'); showToast('Long Tasks Monitor: OFF'); return; }
    const el = PerformanceMonitor.create(id, 'Long Tasks', 'orange');
    longTasksBtn.classList.add('active'); showToast('Long Tasks Monitor: ON');
    let longTaskCount = 0;
    const observer = new PerformanceObserver(entryList => { for (const entry of entryList.getEntries()) { if (entry.duration > CONFIG.LIMITS.LONG_TASK_THRESHOLD) { longTaskCount++; el.textContent = `Long Tasks: ${longTaskCount}`; console.warn('[QA] Long Task:', entry); } } });
    observer.observe({ type: 'longtask', buffered: true }); observer.id = id; STATE.observers.push(observer); el.textContent = `Long Tasks: ${longTaskCount}`;
  }

  function freezeUI(ms) {
    showToast(`Congelando UI por ${ms / 1000}s...`);
    const start = performance.now();
    while (performance.now() - start < ms) { }
    showToast('UI descongelada.');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 🟨 SEÇÃO RESPONSIVO
  // ─────────────────────────────────────────────────────────────────────────
  const secResp = UIFactory.section('🟨 Responsivo');
  const rResp = UIFactory.row();
  const gridBtn = UIFactory.button('Grid', () => toggleGrid());
  const viewportHudBtn = UIFactory.button('Viewport HUD', () => toggleViewportHUD());
  rResp.append(gridBtn, viewportHudBtn);
  secResp.append(rResp);

  function toggleGrid() {
    const id = '__qaGridV51';
    if (document.getElementById(id)) { document.getElementById(id).remove(); gridBtn.classList.remove('active'); showToast('Grid: OFF'); return; }
    const el = document.createElement('div');
    el.id = id;
    Object.assign(el.style, { position: 'fixed', top: '0', left: '0', width: '100%', height: '100%', backgroundImage: 'linear-gradient(to right, rgba(255,0,0,0.1) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,0,0,0.1) 1px, transparent 1px)', backgroundSize: '10px 10px', pointerEvents: 'none', zIndex: '999999999' });
    document.body.appendChild(el);
    gridBtn.classList.add('active');
    showToast('Grid: ON');
  }

  function toggleViewportHUD() {
    const id = '__qaViewportHUDv51';
    if (document.getElementById(id)) { document.getElementById(id).remove(); viewportHudBtn.classList.remove('active'); showToast('Viewport HUD: OFF'); return; }
    const el = document.createElement('div');
    el.id = id;
    Object.assign(el.style, { position: 'fixed', bottom: '10px', right: '10px', zIndex: CONFIG.UI.Z_INDEX, background: 'rgba(0,0,0,0.7)', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '10px', fontFamily: 'monospace' });
    document.body.appendChild(el);
    viewportHudBtn.classList.add('active');
    showToast('Viewport HUD: ON');
    function updateViewportInfo() { el.textContent = `W: ${window.innerWidth}px H: ${window.innerHeight}px D: ${window.devicePixelRatio.toFixed(2)}`; }
    window.addEventListener('resize', updateViewportInfo);
    updateViewportInfo();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 🛡️ SEÇÃO SEGURANÇA+
  // ─────────────────────────────────────────────────────────────────────────
  const secSec = UIFactory.section('🛡️ Segurança+');
  const rTgt = UIFactory.row();
  const tgtLbl = document.createElement('span');
  tgtLbl.textContent = 'Alvo: (nenhum)';
  tgtLbl.style.color = '#bbb';
  rTgt.append(UIFactory.button('Selecionar campo alvo', () => { showToast('Clique no elemento...'); const once = (e) => { e.preventDefault(); e.stopPropagation(); STATE.targetElement = e.target; tgtLbl.textContent = `Alvo: ${STATE.targetElement.tagName.toLowerCase()}#${STATE.targetElement.id || '-'}`; document.removeEventListener('click', once, true); }; document.addEventListener('click', once, true); }), tgtLbl);

  const rSec1 = UIFactory.row();
  const sinksBtn = UIFactory.button('Monitor DOM sinks', () => toggleSinks());
  const cspBtn = UIFactory.button('CSP violations', () => toggleCSP());
  const evalMonitorBtn = UIFactory.button('Monitor eval/Function', () => toggleEvalMonitor());
  rSec1.append(sinksBtn, cspBtn, evalMonitorBtn, UIFactory.button('Teste Clickjacking', () => testClickjacking()));

  const rSec2 = UIFactory.row();
  rSec2.append(UIFactory.button('Cookies expostos', () => auditCookies()), UIFactory.button('Detectar JWT', () => auditJWT()));

  const rSec3 = UIFactory.row();
  rSec3.append(UIFactory.button('Encontrar open-redirect', () => findOpenRedirectParams()), UIFactory.button('Testar 5 open-redirects', () => testOpenRedirectSample(5)));

  const rSec4 = UIFactory.row();
  rSec4.append(UIFactory.button('XSS seguro', () => runXSS({ active: false })), UIFactory.button('XSS ATIVO ⚠️', () => { if (confirm('Rodar XSS ativo? Ambiente controlado apenas.')) runXSS({ active: true }); }), UIFactory.button('SQLi no alvo', () => runSQLi({ scope: 'target' })), UIFactory.button('SQLi em todos', () => runSQLi({ scope: 'all' })), UIFactory.button('Enviar form do alvo', () => submitNearestForm()));

  secSec.append(rTgt, rSec1, rSec2, rSec3, rSec4);

  function toggleSinks() {
    if (STATE.monitors.sinks) { STATE.observers = STATE.observers.filter(o => { if (o.id === '__qaSinksV51') { o.disconnect(); return false; } return true; }); sinksBtn.classList.remove('active'); showToast('DOM Sinks Monitor: OFF'); STATE.monitors.sinks = false; return; }
    const observer = new MutationObserver(mutations => { mutations.forEach(mutation => { if (mutation.type === 'childList' && mutation.addedNodes.length > 0) { mutation.addedNodes.forEach(node => { if (node.nodeType === Node.ELEMENT_NODE && (node.innerHTML?.includes('<script') || node.outerHTML?.includes('javascript:'))) { console.warn('[QA] DOM Sink:', node); showToast('⚠️ DOM Sink detectado!', 3000, 'warning'); } }); } if (mutation.type === 'attributes' && (mutation.attributeName === 'src' || mutation.attributeName === 'href') && (mutation.target.src?.startsWith('javascript:') || mutation.target.href?.startsWith('javascript:'))) { showToast('⚠️ DOM Sink detectado!', 3000, 'warning'); } }); });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['src', 'href'] });
    observer.id = '__qaSinksV51';
    STATE.observers.push(observer);
    sinksBtn.classList.add('active');
    showToast('DOM Sinks Monitor: ON');
    STATE.monitors.sinks = true;
  }

  function toggleCSP() {
    if (STATE.monitors.csp) { window.removeEventListener('securitypolicyviolation', handleCSPViolation); cspBtn.classList.remove('active'); showToast('CSP Monitor: OFF'); STATE.monitors.csp = false; return; }
    window.addEventListener('securitypolicyviolation', handleCSPViolation);
    cspBtn.classList.add('active');
    showToast('CSP Monitor: ON');
    STATE.monitors.csp = true;
  }

  function handleCSPViolation(e) { console.warn('[QA] CSP Violation:', e); showToast(`🚨 CSP: ${e.violatedDirective}`, 3000, 'error'); }

  function toggleEvalMonitor() {
    if (STATE.monitors.evalMonitor) { window.eval = STATE.original.eval; window.Function = STATE.original.Function; evalMonitorBtn.classList.remove('active'); showToast('Eval/Function Monitor: OFF'); STATE.monitors.evalMonitor = false; return; }
    window.eval = function (...args) { console.warn('[QA] eval() chamado:', args[0]); showToast('⚠️ eval() detectado!', 3000, 'warning'); return STATE.original.eval.apply(this, args); };
    window.Function = function (...args) { console.warn('[QA] Function() chamado:', args[args.length - 1]); showToast('⚠️ Function() detectado!', 3000, 'warning'); return STATE.original.Function.apply(this, args); };
    evalMonitorBtn.classList.add('active');
    showToast('Eval/Function Monitor: ON');
    STATE.monitors.evalMonitor = true;
  }

  function testClickjacking() { if (window.self !== window.top) { showToast('Em iframe. Tentando quebrar...'); try { window.top.location = window.self.location; } catch (e) { showToast('Frame protegido.', 3000, 'info'); } } else { showToast('Não em iframe.', 3000, 'info'); } }

  function auditCookies() { const cookies = document.cookie.split(';').map(c => c.trim()).filter(Boolean); const exposed = cookies.map(c => { const [name, value] = c.split('='); return { name, value }; }); console.table(exposed); showToast(`${exposed.length} cookie(s) exposto(s).`); }

  function auditJWT() {
    const tokens = [];
    for (let i = 0; i < localStorage.length; i++) { const key = localStorage.key(i); const value = localStorage.getItem(key); if (typeof value === 'string' && CONFIG.PATTERNS.JWT.test(value)) { tokens.push({ source: 'localStorage', key, value, decoded: decodeJWT(value) }); } }
    for (let i = 0; i < sessionStorage.length; i++) { const key = sessionStorage.key(i); const value = sessionStorage.getItem(key); if (typeof value === 'string' && CONFIG.PATTERNS.JWT.test(value)) { tokens.push({ source: 'sessionStorage', key, value, decoded: decodeJWT(value) }); } }
    document.cookie.split(';').forEach(c => { const [name, value] = c.trim().split('='); if (typeof value === 'string' && CONFIG.PATTERNS.JWT.test(value)) { tokens.push({ source: 'cookie', key: name, value, decoded: decodeJWT(value) }); } });
    if (tokens.length > 0) { console.table(tokens); showToast(`${tokens.length} JWT(s) detectado(s).`, 3000, 'warning'); } else { showToast('Nenhum JWT detectado.', 3000, 'info'); }
  }

  function decodeJWT(token) { try { const parts = token.split('.'); const header = JSON.parse(atob(parts[0])); const payload = JSON.parse(atob(parts[1])); return { header, payload }; } catch (e) { return { error: 'Falha ao decodificar JWT', details: e.message }; } }

  async function findOpenRedirectParams() {
    showToast('Buscando parâmetros de open-redirect...');
    const params = new Set();
    const url = new URL(window.location.href);
    url.searchParams.forEach((value, key) => { if (CONFIG.PATTERNS.URL_PROTOCOL.test(value) || value.startsWith('//')) { params.add(key); } });
    ['redirect', 'url', 'next', 'destination', 'returnTo', 'continue'].forEach(p => { if (url.searchParams.has(p)) params.add(p); });
    if (params.size > 0) { console.log('[QA] Open Redirect params:', Array.from(params)); showToast(`${Array.from(params).join(', ')} suspeitos.`, 3000, 'warning'); } else { showToast('Nenhum parâmetro suspeito.', 3000, 'info'); }
  }

  async function testOpenRedirectSample(count = 5) {
    showToast(`Testando ${count} open-redirects...`);
    const testUrls = ['https://www.google.com', 'https://www.bing.com', 'https://example.com', 'data:text/html,<script>alert(\'XSS\')</script>', 'javascript:alert(\'XSS\')'];
    const url = new URL(window.location.href);
    const originalParams = Array.from(url.searchParams.keys()).filter(k => { const val = url.searchParams.get(k); return CONFIG.PATTERNS.URL_PROTOCOL.test(val) || val.startsWith('//') || ['redirect', 'url', 'next', 'destination', 'returnTo', 'continue'].includes(k); });
    if (originalParams.length === 0) { showToast('Nenhum parâmetro de redirect para testar.', 3000, 'info'); return; }
    for (const param of originalParams) { for (let i = 0; i < Math.min(count, testUrls.length); i++) { const testUrl = testUrls[i]; const newUrl = new URL(window.location.href); newUrl.searchParams.set(param, testUrl); console.log(`[QA] Test: ${newUrl.href}`); } }
    showToast('Testes iniciados. Veja console.', 3000, 'info');
  }

  function runXSS({ active = false } = {}) {
    const ts = Date.now();
    const targets = DOM.getAllInputs().filter(el => CONFIG.PATTERNS.INPUT_TYPES.test(el.type) || el.tagName === 'TEXTAREA');
    if (!targets.length) { showToast('Nenhum campo elegível.', 3000, 'info'); return; }
    const safeMarker = `QA-XSS-TEST-${ts}`;
    const payloads = active ? [`"><script>alert('XSS ${ts}')</script>`, `javascript:alert('XSS ${ts}')`, `"><iframe srcdoc="<script>alert('XSS ${ts}')<\/script>">`] : [safeMarker, `"><qa-xss-${ts}/>`, `&lt;img src=x onerror=alert('XSS ${ts}')&gt;`];
    for (const el of targets) { const payload = payloads[Math.floor(Math.random() * payloads.length)]; DOM.setInputValue(el, payload); console.log('[QA] XSS Test:', { el, value: payload }); }
    showToast(`XSS ${active ? 'ATIVO' : 'SEGURO'} em ${targets.length} campo(s).`, 3000, active ? 'warning' : 'success');
  }

  function runSQLi({ scope = 'target' } = {}) {
    const probes = [`' OR 1=1 --`, `') OR '1'='1`, `admin' --`, `' UNION SELECT NULL--`, `abc'; DROP TABLE users;--`, `'; WAITFOR DELAY '0:0:2'--`];
    const targets = (scope === 'target' && STATE.targetElement) ? [STATE.targetElement] : DOM.getAllInputs().filter(el => CONFIG.PATTERNS.INPUT_TYPES.test(el.type) || el.tagName === 'TEXTAREA');
    if (!targets.length) { showToast('Nenhum campo elegível.', 3000, 'info'); return; }
    for (const el of targets) { const value = probes[Math.floor(Math.random() * probes.length)]; DOM.setInputValue(el, value); console.warn('[QA] SQLi Probe:', { el, value }); }
    showToast(`SQLi em ${targets.length} campo(s).`, 3000, 'warning');
  }

  function submitNearestForm() { if (!STATE.targetElement) { showToast('Selecione um ALVO primeiro.', 3000, 'warning'); return; } const form = STATE.targetElement.closest('form'); if (form) { form.submit(); showToast('Formulário submetido.'); } else { showToast('Nenhum formulário próximo.', 3000, 'info'); } }

  // ─────────────────────────────────────────────────────────────────────────
  // 🔎 SEÇÃO AUDITORIAS
  // ─────────────────────────────────────────────────────────────────────────
  const secAudit = UIFactory.section('🔎 Auditorias UI/A11y');
  const rAu1 = UIFactory.row();
  
  function auditDupIds() { 
    const ids = {}; 
    document.querySelectorAll('[id]').forEach(el => { const id = el.id; ids[id] = ids[id] || []; ids[id].push(el); }); 
    DOM.forEachIframe(iframeDoc => { iframeDoc.querySelectorAll('[id]').forEach(el => { const id = el.id; ids[id] = ids[id] || []; ids[id].push(el); }); }); 
    const dups = Object.entries(ids).filter(([id, list]) => list.length > 1); 
    dups.forEach(([id, list]) => list.forEach(el => markElement(el, CONFIG.MARK_COLORS.ORPHAN))); 
    console.table(dups.map(([id, list]) => ({ id, count: list.length }))); 
    createAuditSnapshot('Duplicate IDs', dups); 
    showToast(`${dups.length} ID(s) duplicado(s).`); 
  }
  
  function auditBrokenLinks() { 
    const set = new Set(Array.from(document.querySelectorAll('[id]')).map(el => el.id)); 
    DOM.forEachIframe(iframeDoc => Array.from(iframeDoc.querySelectorAll('[id]')).map(el => set.add(el.id))); 
    const list = Array.from(document.querySelectorAll('a[href^="#"]')).map(a => a.getAttribute('href').slice(1)); 
    DOM.forEachIframe(iframeDoc => Array.from(iframeDoc.querySelectorAll('a[href^="#"]')).map(a => list.push(a.getAttribute('href').slice(1)))); 
    const broken = list.filter(id => id && !set.has(id)); 
    console.table(broken.map(id => ({ id, href: '#' + id }))); 
    createAuditSnapshot('Broken Anchors', broken); 
    showToast(`${broken.length} anchor(s) quebrado(s).`); 
  }
  
  function auditContrast() { 
    function parseColor(c) { const m = c.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i); return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [0, 0, 0]; } 
    function relLum([r, g, b]) { const vals = [r, g, b].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * vals[0] + 0.7152 * vals[1] + 0.0722 * vals[2]; } 
    function ratio(fg, bg) { const L1 = Math.max(relLum(fg), relLum(bg)) + 0.05; const L2 = Math.min(relLum(fg), relLum(bg)) + 0.05; return L1 / L2; } 
    const items = []; 
    function checkContrast(doc) { 
      doc.querySelectorAll('*').forEach(el => { 
        const cs = getComputedStyle(el); 
        if (!el.textContent || !el.offsetParent) return; 
        const size = parseFloat(cs.fontSize || '0'); 
        const large = size >= 18 || (size >= 14 && (cs.fontWeight === '700' || parseInt(cs.fontWeight) >= 700)); 
        const rr = ratio(parseColor(cs.color), parseColor(cs.backgroundColor || 'rgb(255,255,255)')); 
        const pass = rr >= (large ? 3 : 4.5); 
        if (!pass) { el.__qaOldOutline = el.style.outline; el.style.outline = '2px solid #ffc107'; items.push({ el, ratio: rr.toFixed(2), size, large }); } 
      }); 
    } 
    checkContrast(document); 
    DOM.forEachIframe(checkContrast); 
    console.table(items.map(i => ({ ratio: i.ratio, large: i.large, node: i.el }))); 
    createAuditSnapshot('Contrast Issues', items); 
    showToast(`${items.length} elemento(s) com contraste baixo.`); 
  }
  
  rAu1.append(UIFactory.button('IDs duplicados', auditDupIds), UIFactory.button('Links quebrados', auditBrokenLinks), UIFactory.button('Contraste rápido', auditContrast));
  const rAu2 = UIFactory.row();
  
  function auditTruncation() { 
    const nodes = []; 
    function findTruncation(doc) { 
      Array.from(doc.querySelectorAll('*')).filter(el => { 
        if (!el.firstChild || !el.textContent || !el.offsetParent) return false; 
        const cs = getComputedStyle(el); 
        return (cs.overflow !== 'visible' || cs.textOverflow === 'ellipsis') && el.scrollWidth - 1 > el.clientWidth; 
      }).forEach(el => nodes.push(el)); 
    } 
    findTruncation(document); 
    DOM.forEachIframe(findTruncation); 
    nodes.forEach(el => markElement(el, '#e91e63')); 
    createAuditSnapshot('Truncation', nodes); 
    showToast(`${nodes.length} elemento(s) com truncamento.`); 
  }
  
  function auditClickThrough() { 
    const nodes = []; 
    function findClickThrough(doc) { 
      Array.from(doc.querySelectorAll('a,button,[role="button"],[onclick]')).forEach(el => { 
        const r = el.getBoundingClientRect(); 
        if (r.width < 6 || r.height < 6) return; 
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2; 
        const topEl = doc.elementFromPoint(cx, cy); 
        if (topEl && topEl !== el && !el.contains(topEl)) { nodes.push(el); } 
      }); 
    } 
    findClickThrough(document); 
    DOM.forEachIframe(findClickThrough); 
    nodes.forEach(el => markElement(el, '#ff5722')); 
    createAuditSnapshot('Click Through', nodes); 
    showToast(`${nodes.length} sobreposições de clique.`); 
  }
  
  rAu2.append(UIFactory.button('Truncamento', auditTruncation), UIFactory.button('Sobreposição clique', auditClickThrough));
  secAudit.append(rAu1, rAu2);

  // ─────────────────────────────────────────────────────────────────────────
  // 🎨 SEÇÃO UX - VALIDAÇÕES
  // ─────────────────────────────────────────────────────────────────────────
  const secUX = UIFactory.section('🎨 UX – Validações');
  const rUX0 = UIFactory.row();
  const uxLbl = document.createElement('span');
  uxLbl.textContent = 'Seção: (nenhuma)';
  uxLbl.style.color = '#bbb';
  rUX0.append(UIFactory.button('Selecionar seção', () => { showToast('Clique no título da seção...'); const once = (e) => { e.preventDefault(); e.stopPropagation(); STATE.uxSection = e.target; uxLbl.textContent = 'Seção: ' + (STATE.uxSection.textContent || STATE.uxSection.id || STATE.uxSection.tagName); document.removeEventListener('click', once, true); }; document.addEventListener('click', once, true); }), uxLbl);
  const rUX1 = UIFactory.row();
  rUX1.append(UIFactory.button('Órfãos próximos', () => detectOrphansNearSection()), UIFactory.button('Varredura órfãos', () => scanOrphanFields()), UIFactory.button('Sem rótulo', () => scanUnlabeled()));
  const rUX2 = UIFactory.row();
  rUX2.append(UIFactory.button('Sem "name"', () => scanNoNameInsideForm()), UIFactory.button('Focáveis invisíveis', () => scanFocusableInvisible()), UIFactory.button('Limpar marcações', () => clearAllMarks()));
  secUX.append(rUX0, rUX1, rUX2, UIFactory.hint('Magenta=órfão | Azul=sem rótulo | Laranja=invisível | Ciano=sem name'));

  function detectOrphansNearSection() { if (!STATE.uxSection) { showToast('Selecione a seção primeiro.', 3000, 'warning'); return; } clearAllMarks(); const ctrls = findControlsNear(STATE.uxSection); const findings = []; for (const el of ctrls) { const name = DOM.getAccessibleName(el); const empty = (el.value || '').length === 0; const optional = !el.required; const noName = !el.name && !!el.closest('form'); const labeled = !!name || !!(el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)) || !!el.closest('label'); const suspicious = (empty && optional && !labeled) || noName; if (suspicious) { markElement(el, CONFIG.MARK_COLORS.ORPHAN); findings.push({ motivo: noName ? 'sem name' : 'vazio/opcional/sem rótulo', el, accName: name }); } } console.table(findings); showToast(`${findings.length} órf­ão(s) detectado(s).`); }

  function scanOrphanFields() { clearAllMarks(); const items = []; const processDoc = (doc) => { const headings = Array.from(doc.querySelectorAll('h1,h2,h3,h4,h5,h6,legend,th,dt,strong,b,label')).filter(DOM.isVisible).concat(Array.from(doc.querySelectorAll('span,div,p')).filter(el => DOM.isVisible(el) && looksLikeHeading(el))); const seen = new Set(); for (const h of headings) { findControlsNear(h).forEach(el => { if (seen.has(el)) return; seen.add(el); const name = DOM.getAccessibleName(el); const empty = (el.value || '').length === 0; const optional = !el.required; const noName = !el.name && !!el.closest('form'); const labeled = !!name || !!(el.id && doc.querySelector(`label[for="${CSS.escape(el.id)}"]`)) || !!el.closest('label'); const suspicious = (empty && optional && !labeled) || noName; if (suspicious) { markElement(el, CONFIG.MARK_COLORS.ORPHAN); items.push({ titulo: (h.textContent || '').trim().slice(0, 60), motivo: noName ? 'sem name' : 'vazio/opcional/sem rótulo', node: el }); } }); } }; processDoc(document); DOM.forEachIframe(processDoc); console.table(items); showToast(`${items.length} órf­ão(s) encontrado(s).`); }

  function scanUnlabeled() { clearAllMarks(); const bad = []; const processDoc = (doc) => { Array.from(doc.querySelectorAll('input,textarea,select')).filter(DOM.isVisible).filter(el => !DOM.getAccessibleName(el)).forEach(el => bad.push(el)); }; processDoc(document); DOM.forEachIframe(processDoc); bad.forEach(el => markElement(el, CONFIG.MARK_COLORS.UNLABELED)); console.table(bad.map(el => ({ tag: el.tagName.toLowerCase(), id: el.id, name: el.name }))); showToast(`${bad.length} sem rótulo.`); }

  function scanNoNameInsideForm() { clearAllMarks(); const list = []; const processDoc = (doc) => { Array.from(doc.querySelectorAll('form input, form textarea, form select')).filter(DOM.isVisible).filter(el => !el.name).forEach(el => list.push(el)); }; processDoc(document); DOM.forEachIframe(processDoc); list.forEach(el => markElement(el, CONFIG.MARK_COLORS.NO_NAME)); console.table(list.map(el => ({ form: el.form?.action || '(inline)', tag: el.tagName.toLowerCase(), id: el.id }))); showToast(`${list.length} sem "name".`); }

  function scanFocusableInvisible() { clearAllMarks(); const bad = []; const processDoc = (doc) => { const all = Array.from(doc.querySelectorAll('*')).filter(DOM.isFocusable); all.filter(el => !DOM.isVisible(el)).forEach(el => bad.push(el)); }; processDoc(document); DOM.forEachIframe(processDoc); bad.forEach(el => markElement(el, CONFIG.MARK_COLORS.INVISIBLE)); console.table(bad.map(el => ({ tag: el.tagName.toLowerCase(), id: el.id, clazz: el.className }))); showToast(`${bad.length} focáveis invisíveis.`); }

  // ─────────────────────────────────────────────────────────────────────────
  // 🌍 SEÇÃO i18n
  // ─────────────────────────────────────────────────────────────────────────
  const secI18n = UIFactory.section('🌍 i18n & Conteúdo');
  const rI1 = UIFactory.row();
  rI1.append(UIFactory.button('Texto LONGO', () => fillLongText()), UIFactory.button('RTL/Bidi', () => applyRTL()), UIFactory.button('Emoji', () => fillEmoji()));
  secI18n.append(rI1);

  function fillLongText() { const targets = DOM.getAllInputs().filter(el => ['text', 'search', 'email', 'password', 'tel', 'url', 'textarea', ''].includes((el.type || '').toLowerCase()) || el.tagName === 'TEXTAREA'); const long = 'L'.repeat(400) + ' fim'; targets.forEach(el => DOM.setInputValue(el, long)); showToast(`Texto longo em ${targets.length} campo(s).`); }
  function applyRTL() { document.documentElement.dir = (document.documentElement.dir === 'rtl' ? 'ltr' : 'rtl'); showToast(`Direção: ${document.documentElement.dir.toUpperCase()}`); }
  function fillEmoji() { const targets = DOM.getAllInputs(); const txt = '👩🏽‍💻🚀🔥✨ — qa-emoji-🧪'; targets.forEach(el => DOM.setInputValue(el, txt)); showToast(`Emoji em ${targets.length} campo(s).`); }

  // ─────────────────────────────────────────────────────────────────────────
  // ⚙️ SEÇÃO FLUXO & REDE
  // ─────────────────────────────────────────────────────────────────────────
  const secFlow = UIFactory.section('⚙️ Fluxo & Rede');
  const rF1 = UIFactory.row();
  const burstUrl = UIFactory.input('text', location.origin, '190px');
  const burstQty = UIFactory.input('number', '10', '64px');
  burstQty.min = '1'; burstQty.step = '1';
  rF1.append(UIFactory.label('URL:', burstUrl), UIFactory.label('N:', burstQty), UIFactory.button('Burst GET', () => burstRequests(burstUrl.value, Number(burstQty.value || '10'))));
  const rF2 = UIFactory.row();
  const spamN = UIFactory.input('number', '15', '64px');
  spamN.min = '1'; spamN.step = '1';
  rF2.append(UIFactory.label('Spam-click N:', spamN), UIFactory.button('Rodar no ALVO', () => spamClick(Number(spamN.value || '15'))));
  secFlow.append(rF1, rF2);

  function spamClick(n = 15, delay = 50) { const el = STATE.targetElement; if (!el) { showToast('Selecione ALVO primeiro.', 3000, 'warning'); return; } let i = 0; const id = setInterval(() => { try { el.click(); } catch { } i++; if (i >= n) clearInterval(id); }, Math.max(0, delay)); showToast(`Spam-click iniciado (${n} cliques).`); }

  async function burstRequests(url, n = 10) { if (!/^https?:/i.test(url)) { try { url = new URL(url, location.href).href; } catch { showToast('URL inválida.', 3000, 'error'); return; } } showToast(`Burst GET para ${n} requisições...`); const t0 = performance.now(); const ps = Array.from({ length: n }).map((_, i) => fetch(url, { cache: 'no-store' }).then(r => ({ i, status: r.status })).catch(e => ({ i, status: 'ERR' }))); const res = await Promise.all(ps); console.table(res); showToast(`Burst concluído (${n} req ~${Math.round(performance.now() - t0)}ms).`); }

  // ─────────────────────────────────────────────────────────────────────────
  // 🧰 SEÇÃO STORAGE / SW / CACHE
  // ─────────────────────────────────────────────────────────────────────────
  const secSW = UIFactory.section('🧰 Storage / SW / Cache');
  const rSW1 = UIFactory.row();
  rSW1.append(UIFactory.button('Listar SW', () => listSW()), UIFactory.button('Unregister SW', () => unregisterSW()), UIFactory.button('Limpar Cache Storage', () => clearCaches()), UIFactory.button('Limpar local+session', () => clearStorage()));
  const rSW2 = UIFactory.row();
  const quotaMB = UIFactory.input('number', '5', '64px');
  quotaMB.min = '1'; quotaMB.step = '1';
  rSW2.append(UIFactory.label('Preencher localStorage (MB):', quotaMB), UIFactory.button('Executar', () => fillLocalStorageMB(Number(quotaMB.value || '5'))), UIFactory.button('Limpar cookies (JS)', () => clearJsCookies()));
  secSW.append(rSW1, rSW2, UIFactory.hint('Cookies HttpOnly não removíveis via JS.'));

  async function listSW() { if (!('serviceWorker' in navigator)) { showToast('SW não suportado.', 3000, 'info'); return; } const regs = await navigator.serviceWorker.getRegistrations(); console.table(regs.map(r => ({ scope: r.scope, active: !!r.active, installing: !!r.installing, waiting: !!r.waiting }))); showToast(`${regs.length} SW registration(s).`); }
  async function unregisterSW() { if (!('serviceWorker' in navigator)) { showToast('SW não suportado.', 3000, 'info'); return; } const regs = await navigator.serviceWorker.getRegistrations(); await Promise.all(regs.map(r => r.unregister())); showToast(`${regs.length} SW desregistrados.`); }
  async function clearCaches() { if (!('caches' in window)) { showToast('Cache Storage não suportado.', 3000, 'info'); return; } const keys = await caches.keys(); await Promise.all(keys.map(k => caches.delete(k))); showToast(`Cache Storage limpo (${keys.length}).`); }
  function clearStorage() { try { localStorage.clear(); sessionStorage.clear(); showToast('localStorage + sessionStorage limpos.'); } catch (e) { showToast('Falha ao limpar storage: ' + e.message, 3000, 'error'); } }
  function fillLocalStorageMB(mb = 5) { try { const key = '__qa_fill__'; const chunk = 'X'.repeat(1024 * 1024); let data = ''; for (let i = 0; i < mb; i++) data += chunk; localStorage.setItem(key, data); showToast(`~${mb}MB em localStorage.`); } catch (e) { showToast('Falhou preencher localStorage: ' + (e.message || e), 3000, 'error'); } }
  function clearJsCookies() { const list = (document.cookie || '').split(';').map(s => s.trim()).filter(Boolean); let count = 0; list.forEach(pair => { const name = pair.split('=')[0]; document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`; count++; }); showToast(`Tentou remover ${count} cookie(s).`); }

  // ─────────────────────────────────────────────────────────────────────────
  // 📊 SEÇÃO RELATÓRIOS & EXPORTS
  // ─────────────────────────────────────────────────────────────────────────
  const secReports = UIFactory.section('📊 Relatórios & Exports');
  const rExp1 = UIFactory.row();
  rExp1.append(
    UIFactory.button('📄 JSON Export', () => generateJSON()),
    UIFactory.button('🖼️ PDF/PNG', () => generatePDF()),
    UIFactory.button('📸 Screenshot', () => captureScreenshot())
  );
  const rExp2 = UIFactory.row();
  rExp2.append(
    UIFactory.button('🔍 Performance', () => { const perf = getPerformanceSummary(); console.table(perf); createAuditSnapshot('Performance', perf); showToast('✅ Snapshot criado!'); }),
    UIFactory.button('🔄 Comparar', () => compareAudits()),
    UIFactory.button('🗂️ Limpar', () => { STATE.auditReports = []; localStorage.removeItem(CONFIG.AUDIT_REPORTS); showToast('Relatórios limpos.'); })
  );
  rExp2.append(UIFactory.hint(`${STATE.auditReports.length} relatório(s) no histórico`));
  secReports.append(rExp1, rExp2);

  // ─────────────────────────────────────────────────────────────────────────
  // 📊 SISTEMA DE RELATÓRIOS & EXPORTS
  // ─────────────────────────────────────────────────────────────────────────
  function generatePDF() {
    // Tenta usar jsPDF se disponível, senão gera HTML para print
    if (typeof jsPDF !== 'undefined' && typeof html2canvas !== 'undefined') {
      generatePDFWithLibraries();
    } else {
      generatePDFAsHTML();
    }
  }
  
  function generatePDFWithLibraries() {
    showToast('Gerando PDF com bibliotecas...');
    html2canvas(document.body, { backgroundColor: '#fff', scale: 2 }).then(canvas => {
      const { jsPDF } = window;
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF();
      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;
      
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= 297;
      
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= 297;
      }
      
      pdf.save(`qa-audit-${Date.now()}.pdf`);
      showToast('📄 PDF exportado com sucesso!');
    });
  }
  
  function generatePDFAsHTML() {
    showToast('Gerando PDF (formato imprimível)...');
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>QA Audit Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; background: #f9f9f9; }
    .report-header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #4CAF50; padding-bottom: 20px; }
    .report-header h1 { color: #333; margin: 0; font-size: 28px; }
    .report-header p { color: #666; margin: 10px 0 0; font-size: 12px; }
    .audit-section { page-break-inside: avoid; margin-bottom: 25px; background: white; padding: 15px; border-left: 4px solid #4CAF50; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .audit-section h3 { color: #4CAF50; margin-top: 0; font-size: 16px; }
    .audit-data { background: #f5f5f5; padding: 10px; border-radius: 4px; font-family: monospace; font-size: 11px; white-space: pre-wrap; word-break: break-word; max-height: 300px; overflow: auto; }
    .stat-row { display: flex; justify-content: space-between; margin: 5px 0; font-size: 12px; }
    .stat-label { font-weight: bold; color: #333; }
    .stat-value { color: #666; }
    .page-break { page-break-after: always; }
    .footer { text-align: center; margin-top: 40px; color: #999; font-size: 10px; border-top: 1px solid #ddd; padding-top: 10px; }
    @media print {
      body { margin: 0; background: white; }
      .report-header { border-color: #4CAF50; }
    }
  </style>
</head>
<body>
  <div class="report-header">
    <h1>🧪 QA Menu Audit Report</h1>
    <p>Gerado em ${new Date().toLocaleString('pt-BR')}</p>
    <p>URL: ${window.location.href}</p>
  </div>
  
  <div style="background: white; padding: 15px; margin-bottom: 20px; border-radius: 4px;">
    <h2 style="margin-top: 0; color: #333;">Sumário</h2>
    <div class="stat-row">
      <span class="stat-label">Total de Auditorias:</span>
      <span class="stat-value">${STATE.auditReports.length}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">Última Auditoria:</span>
      <span class="stat-value">${STATE.lastAuditTime ? new Date(STATE.lastAuditTime).toLocaleString('pt-BR') : 'Nenhuma'}</span>
    </div>
  </div>
  
  ${STATE.auditReports.map((report, idx) => `
  <div class="audit-section">
    <h3>${idx + 1}. ${report.name}</h3>
    <div class="stat-row">
      <span class="stat-label">Timestamp:</span>
      <span class="stat-value">${new Date(report.timestamp).toLocaleString('pt-BR')}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">Itens encontrados:</span>
      <span class="stat-value">${report.itemCount}</span>
    </div>
    <h4 style="margin: 10px 0 5px; color: #666; font-size: 12px;">Dados:</h4>
    <div class="audit-data">${report.data}</div>
  </div>
  `).join('\n')}
  
  <div class="footer">
    <p>Relatório gerado por QA Menu V0.3 - Ferramenta de QA e Auditoria</p>
    <p>Impressão recomendada: Orientação paisagem, margens 10mm, escala 90%</p>
  </div>
</body>
</html>
    `;
    
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = url;
    document.body.appendChild(iframe);
    
    iframe.onload = () => {
      setTimeout(() => {
        iframe.contentWindow.print();
        showToast('📄 PDF aberto para impressão!');
        setTimeout(() => {
          document.body.removeChild(iframe);
          URL.revokeObjectURL(url);
        }, 1000);
      }, 500);
    };
  }

  function generateJSON() {
    const data = {
      timestamp: new Date().toISOString(),
      url: window.location.href,
      summary: {
        totalReports: STATE.auditReports.length,
        lastAuditTime: STATE.lastAuditTime
      },
      audits: STATE.auditReports || [],
      performance: {
        fps: 'monitor disabled',
        cls: 'monitor disabled',
        longTasks: 'monitor disabled'
      },
      network: {
        patched: STATE.network.patched,
        offline: STATE.network.offline,
        delay: STATE.network.delay
      }
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `qa-report-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('📄 JSON exportado!');
  }

  function captureScreenshot() {
    if (typeof html2canvas !== 'undefined') {
      showToast('Capturando screenshot...');
      html2canvas(document.body).then(canvas => {
        const link = document.createElement('a');
        link.href = canvas.toDataURL();
        link.download = `screenshot-${Date.now()}.png`;
        link.click();
        showToast('📸 Screenshot salvo!');
      });
    } else {
      showToast('html2canvas não disponível. Use JSON export.', 3000, 'info');
    }
  }

  function getPerformanceSummary() {
    const perf = performance.getEntriesByType('navigation')[0];
    const paint = performance.getEntriesByType('paint');
    return {
      navigationTiming: {
        domContentLoaded: perf?.domContentLoadedEventEnd - perf?.domContentLoadedEventStart,
        loadComplete: perf?.loadEventEnd - perf?.loadEventStart,
        domInteractive: perf?.domInteractive - perf?.fetchStart
      },
      paintEvents: paint.map(p => ({ name: p.name, time: p.startTime.toFixed(2) })),
      memoryUsage: performance.memory ? {
        usedJSHeapSize: (performance.memory.usedJSHeapSize / 1048576).toFixed(2) + ' MB',
        totalJSHeapSize: (performance.memory.totalJSHeapSize / 1048576).toFixed(2) + ' MB',
        jsHeapSizeLimit: (performance.memory.jsHeapSizeLimit / 1048576).toFixed(2) + ' MB'
      } : 'Not available'
    };
  }

  function createAuditSnapshot(auditName, findings) {
    const snapshot = {
      name: auditName,
      timestamp: new Date().toISOString(),
      data: typeof findings === 'string' ? findings : JSON.stringify(findings, null, 2),
      itemCount: Array.isArray(findings) ? findings.length : 0
    };
    STATE.auditReports.push(snapshot);
    STATE.lastAuditTime = new Date();
    localStorage.setItem(CONFIG.AUDIT_REPORTS, JSON.stringify(STATE.auditReports));
    return snapshot;
  }

  function compareAudits() {
    if (STATE.auditReports.length < 2) {
      showToast('Pelo menos 2 auditorias necessárias para comparar.', 3000, 'warning');
      return;
    }
    
    const first = STATE.auditReports[0];
    const last = STATE.auditReports[STATE.auditReports.length - 1];
    const summary = `
📊 COMPARAÇÃO DE AUDITORIAS
─────────────────────────
Primeira: ${first.name} (${first.timestamp})
Última: ${last.name} (${last.timestamp})
Mudanças: ${first.itemCount} → ${last.itemCount} items
    `;
    console.log(summary);
    showToast('✅ Comparação no console!', 3000, 'success');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 📋 SEÇÕES DE FUNCIONALIDADES (continuação)
  // ─────────────────────────────────────────────────────────────────────────
  function destroy() {
    try {
      window.fetch = STATE.original.fetch;
      window.XMLHttpRequest = STATE.original.XHR;
      window.eval = STATE.original.eval;
      window.Function = STATE.original.Function;
      
      if (STATE.monitors.sinks) toggleSinks();
      if (STATE.monitors.csp) toggleCSP();
      if (STATE.monitors.evalMonitor) toggleEvalMonitor();
      
      STATE.observers.forEach(o => o.disconnect?.());
      STATE.observers = [];
      cancelAnimationFrame(STATE.monitors.fps_raf);
      
      ['__qaOutlineStyleV51', '__qaFpsV51', '__qaClsV51', '__qaGridV51', '__qaViewportHUDv51'].forEach(id => document.getElementById(id)?.remove());
      document.documentElement.classList.remove('__qaOutlineV51');
      clearAllMarks();
      STATE.snapshots.clear();
      HUD_HOST.remove();
      
      console.log('[QA V0.3] ✓ Cleanup concluído.');
    } finally {
      delete window.__qaHUDv51;
    }
  }

  window.__qaHUDv51 = { destroy };

  // ─────────────────────────────────────────────────────────────────────────
  // 📦 MOUNT ALL SECTIONS
  // ─────────────────────────────────────────────────────────────────────────
  BODY.append(secUI, secAPI, secPerf, secResp, secSec, secAudit, secUX, secI18n, secFlow, secSW, secReports);

  // Restaurar estados persistentes
  if (document.documentElement.classList.contains('__qaOutlineV51')) outlineBtn.classList.add('active');
  if (STATE.network.patched) patchNetworkBtn.classList.add('active');
  if (STATE.network.offline) offlineBtn.classList.add('active');
  if (STATE.monitors.sinks) sinksBtn.classList.add('active');
  if (STATE.monitors.csp) cspBtn.classList.add('active');
  if (STATE.monitors.evalMonitor) evalMonitorBtn.classList.add('active');

  console.log('[QA V0.3] ✓ Menu carregado com sucesso! 🎉');
})();
