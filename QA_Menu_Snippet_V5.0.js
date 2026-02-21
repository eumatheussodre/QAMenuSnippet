(() => {
  // Versão 5.0 - Melhorias de Robustez, Arquitetura, Segurança, Performance e UX
  // Rodar: DevTools → Sources → Snippets → Ctrl+Enter
  // Observação: roda no contexto da página (não altera configs do DevTools).
  // =============================================================================

  if (window.__qaHUDv50 && window.__qaHUDv50.destroy) { window.__qaHUDv50.destroy(); }

  const S = {
    original: {
      fetch: window.fetch, XHR: window.XMLHttpRequest,
      eval: window.eval, Function: window.Function
    },
    patched: false, offline: false, delay: 0, failRx: [],
    obs: [], raf: 0, host: null, target: null,
    snapshots: new Map(),
    sinksOn: false, cspOn: false, evalOn: false,
    uxSection: null,
    marks: [],
    // Novas propriedades para persistência
    settings: JSON.parse(localStorage.getItem('qaMenuSettingsV50')) || { delay: 0, failRx: [] }
  };

  // Salva as configurações no localStorage
  function saveSettings() {
    localStorage.setItem('qaMenuSettingsV50', JSON.stringify({ delay: S.delay, failRx: S.failRx.map(r => r.source) }));
  }

  // Carrega as configurações ao iniciar
  S.delay = S.settings.delay;
  S.failRx = S.settings.failRx.map(rxStr => new RegExp(rxStr));

  // ---------- Host + Shadow ----------
  const host = document.createElement('div');
  host.id = '__qaHudHostV50';
  Object.assign(host.style, { position:'fixed', right:'12px', top:'12px', zIndex:'2147483647' });
  const shadow = host.attachShadow({ mode:'open' });
  document.documentElement.appendChild(host);

  // ---------- UI helpers ----------
  const style = document.createElement('style');
  style.textContent = `
    :host {
      all: initial; /* Reset all styles */
      font-family: system-ui, Segoe UI, Roboto, Arial, sans-serif;
      font-size: 12px;
      line-height: 1.4;
      color: #eee;
    }
    .qa-box {
      width: 380px;
      background: #111;
      color: #eee;
      border: 1px solid #333;
      border-radius: 10px;
      box-shadow: 0 8px 24px rgba(0,0,0,.35);
      overflow: hidden;
    }
    .qa-header {
      padding: 8px 10px;
      background: linear-gradient(180deg,#1e1e1e,#111);
      border-bottom: 1px solid #2b2b2b;
      font-weight: 600;
      letter-spacing: .5px;
      cursor: move;
      user-select: none;
    }
    .qa-body {
      padding: 10px;
      max-height: 72vh;
      overflow: auto;
    }
    .qa-section {
      margin-bottom: 10px;
    }
    .qa-section h4 {
      margin: 0 0 6px;
      font-size: 12px;
      color: #b39ddb;
    }
    .qa-row {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 6px;
    }
    .qa-btn {
      background: #222;
      color: #eee;
      border: 1px solid #3a3a3a;
      padding: 6px 8px;
      border-radius: 6px;
      cursor: pointer;
      position: relative;
    }
    .qa-btn:hover {
      background: #2a2a2a;
    }
    .qa-btn.active {
      background: #4CAF50;
      border-color: #4CAF50;
    }
    .qa-input {
      background: #1a1a1a;
      color: #eee;
      border: 1px solid #333;
      padding: 4px 6px;
      border-radius: 6px;
    }
    .qa-label {
      display: flex;
      align-items: center;
      gap: 6px;
      color: #ddd;
    }
    .qa-hint {
      color: #888;
      display: block;
      margin-top: 4px;
    }
    /* Toast Notifications */
    .qa-toast-container {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 2147483647;
      display: flex;
      flex-direction: column;
      gap: 10px;
      pointer-events: none; /* Allow clicks to pass through */
    }
    .qa-toast {
      background-color: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 10px 15px;
      border-radius: 5px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
      opacity: 0;
      transition: opacity 0.3s ease-in-out;
      min-width: 200px;
      text-align: center;
    }
    .qa-toast.show {
      opacity: 1;
    }
  `;
  shadow.appendChild(style);

  const box = document.createElement('div');
  box.className = 'qa-box';
  const hd = document.createElement('div');
  hd.className = 'qa-header';
  hd.textContent = 'QA MENU V5.0';
  const bd = document.createElement('div');
  bd.className = 'qa-body';

  shadow.appendChild(box);
  box.append(hd, bd);

  // Toast Container
  const toastContainer = document.createElement('div');
  toastContainer.className = 'qa-toast-container';
  shadow.appendChild(toastContainer);

  function showToast(message, duration = 3000) {
    const toast = document.createElement('div');
    toast.className = 'qa-toast';
    toast.textContent = message;
    toastContainer.appendChild(toast);

    // Trigger reflow to enable transition
    void toast.offsetWidth;
    toast.classList.add('show');

    setTimeout(() => {
      toast.classList.remove('show');
      toast.addEventListener('transitionend', () => toast.remove());
    }, duration);
  }

  const H = (t)=>{ const h=document.createElement('h4'); h.textContent=t; h.className = 'qa-section-title'; return h; };
  const sec = (t)=>{ const s=document.createElement('section'); s.className = 'qa-section'; s.append(H(t)); return s; };
  const row = ()=>{ const r=document.createElement('div'); r.className = 'qa-row'; return r; };
  const btn = (t,fn, className='')=>{ const b=document.createElement('button'); b.textContent=t; b.className = 'qa-btn ' + className; b.onclick=fn; return b; };
  const input = (type,val,w)=>{ const i=document.createElement('input'); i.type=type; i.value=val; i.className = 'qa-input'; Object.assign(i.style, {width:w}); return i; };
  const label = (txt, el) => { const l=document.createElement('label'); l.className = 'qa-label'; l.append(txt, el); return l; };
  const hint = (t)=>{ const s=document.createElement('small'); s.textContent=t; s.className = 'qa-hint'; return s; };

  // Drag functionality for the HUD
  let isDragging = false;
  let offsetX, offsetY;

  hd.addEventListener('mousedown', (e) => {
    isDragging = true;
    offsetX = e.clientX - host.getBoundingClientRect().left;
    offsetY = e.clientY - host.getBoundingClientRect().top;
    host.style.cursor = 'grabbing';
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    host.style.left = (e.clientX - offsetX) + 'px';
    host.style.top = (e.clientY - offsetY) + 'px';
    host.style.right = 'auto'; // Disable right positioning when dragging
    host.style.bottom = 'auto'; // Disable bottom positioning when dragging
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
    host.style.cursor = 'grab';
  });

  // Helper to execute function in iframes (same-origin only)
  function executeInIframes(callback) {
    const iframes = document.querySelectorAll('iframe');
    iframes.forEach(iframe => {
      try {
        const iframeDoc = iframe.contentWindow.document;
        callback(iframeDoc);
      } catch (e) {
        console.warn('[QA Menu] Não foi possível acessar iframe de origem cruzada:', iframe.src, e);
      }
    });
  }

  // Helper to get all inputs, including from same-origin iframes
  function allInputs() {
    let inputs = Array.from(document.querySelectorAll('input, textarea, select'));
    executeInIframes(iframeDoc => {
      inputs = inputs.concat(Array.from(iframeDoc.querySelectorAll('input, textarea, select')));
    });
    return inputs;
  }

  // Helper to set value and dispatch events
  function setVal(el, val) {
    el.value = val;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // Helper to get accessible name
  function accName(el) {
    if (el.labels && el.labels.length > 0) return el.labels[0].textContent.trim();
    if (el.placeholder) return el.placeholder.trim();
    if (el.title) return el.title.trim();
    if (el.getAttribute('aria-label')) return el.getAttribute('aria-label').trim();
    if (el.id) {
      const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (label) return label.textContent.trim();
    }
    return '';
  }

  // Helper to check visibility
  function visible(el) {
    return el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0;
  }

  // Helper to check if element is focusable
  function isFocusable(el) {
    if (el.tabIndex > 0 || (el.tabIndex === 0 && el.getAttribute('tabIndex') !== null)) return true;
    if (el.disabled) return false;
    switch (el.tagName) {
      case 'A': return !!el.href && el.rel !== 'ignore';
      case 'INPUT':
      case 'SELECT':
      case 'TEXTAREA': return true;
      case 'BUTTON': return true;
      default: return false;
    }
  }

  // Helper to mark elements
  function mark(el, color) {
    el.__qaOldOutline = el.style.outline;
    el.style.outline = `2px solid ${color}`;
    S.marks.push(el);
  }

  function uxClearMarks() {
    S.marks.forEach(el => {
      if (el.__qaOldOutline !== undefined) {
        el.style.outline = el.__qaOldOutline;
        delete el.__qaOldOutline;
      }
    });
    S.marks = [];
  }

  // Helper to find controls around a section
  function controlsAround(sectionEl, { hDist = 500, vTol = 60 } = {}) {
    const sectionRect = sectionEl.getBoundingClientRect();
    const allControls = Array.from(document.querySelectorAll('input, textarea, select, button, a[href], [tabindex]'))
      .filter(visible);

    return allControls.filter(ctrl => {
      const ctrlRect = ctrl.getBoundingClientRect();
      const hOverlap = Math.max(0, Math.min(sectionRect.right, ctrlRect.right) - Math.max(sectionRect.left, ctrlRect.left));
      const vOverlap = Math.max(0, Math.min(sectionRect.bottom, ctrlRect.bottom) - Math.max(sectionRect.top, ctrlRect.top));

      const hDistance = Math.abs(sectionRect.left - ctrlRect.left);
      const vDistance = Math.abs(sectionRect.top - ctrlRect.top);

      // Check if control is horizontally close and vertically within tolerance
      return hDistance < hDist && Math.abs(sectionRect.top - ctrlRect.top) < vTol;
    });
  }

  // Helper to detect likely headings
  function likelyHeading(el) {
    const cs = getComputedStyle(el);
    const fontSize = parseFloat(cs.fontSize);
    const fontWeight = parseInt(cs.fontWeight);
    return (fontSize > 16 && fontWeight >= 500) || (fontSize > 20);
  }

  // ================= UI Section =================
  const secUI = sec('🟦 UI');
  const rUI1 = row();
  const outlineBtn = btn('Outline', ()=> {
    document.documentElement.classList.toggle('__qaOutlineV50');
    outlineBtn.classList.toggle('active', document.documentElement.classList.contains('__qaOutlineV50'));
    showToast(`Outline: ${document.documentElement.classList.contains('__qaOutlineV50') ? 'ON' : 'OFF'}`);
  });
  rUI1.append(
    outlineBtn,
    btn('Inspecionar clique', ()=>{
      showToast('Clique no elemento para abri-lo no Elements.');
      const once = (e)=>{ e.preventDefault(); e.stopPropagation(); if (typeof inspect==='function') inspect(e.target); document.removeEventListener('click', once, true); };
      document.addEventListener('click', once, true);
    })
  );
  secUI.append(rUI1);
  const styleOutline = document.createElement('style');
  styleOutline.id = '__qaOutlineStyleV50';
  styleOutline.textContent = `. __qaOutlineV50 * { outline:1px dashed rgba(255,255,255,.25) !important; }`.replace('. ','');
  document.documentElement.appendChild(styleOutline);

  // ================= API Section =================
  const secAPI = sec('🟩 API');
  const rAPI1 = row();
  const delayInput = input('number', S.delay.toString(), '90px'); delayInput.min='0'; delayInput.step='100';
  delayInput.oninput = ()=> { S.delay = Math.max(0, Number(delayInput.value)||0); saveSettings(); showToast(`Atraso de rede: ${S.delay}ms`); };

  const patchNetworkBtn = btn('Ativar/Desativar patch', ()=> {
    patchNetwork();
    patchNetworkBtn.classList.toggle('active', S.patched);
    showToast(`Patch de rede: ${S.patched ? 'ATIVO' : 'DESATIVADO'}`);
  });
  const offlineBtn = btn('Offline', ()=> {
    if(!S.patched) patchNetwork();
    S.offline=!S.offline;
    offlineBtn.classList.toggle('active', S.offline);
    showToast(`Modo Offline: ${S.offline?'ON':'OFF'}`);
  });

  rAPI1.append(
    patchNetworkBtn,
    offlineBtn
  );
  const rAPI2 = row();
  rAPI2.append(
    btn('+ Falha (regex)', ()=> { 
      const rxStr=prompt('Regex de URL (ex.: ^/api/)'); 
      if(!rxStr) return; 
      try{
        const newRx = new RegExp(rxStr);
        S.failRx.push(newRx);
        saveSettings();
        showToast(`Adicionado regra de falha: ${rxStr}`);
      }catch(e){ 
        showToast(`Regex inválido: ${e.message}`); 
        console.error('[QA Menu] Regex inválido:', e);
      }
    }),
    btn('Limpar', ()=> { 
      S.failRx=[]; 
      saveSettings();
      showToast('Regras de falha limpas'); 
    }),
    label('Atraso (ms):', delayInput)
  );
  secAPI.append(rAPI1, rAPI2);

  // Network patching logic
  function patchNetwork() {
    if (S.patched) {
      window.fetch = S.original.fetch;
      window.XMLHttpRequest = S.original.XHR;
      S.patched = false;
      return;
    }

    window.fetch = async function(...args) {
      const url = args[0] instanceof Request ? args[0].url : args[0];
      if (S.offline) throw new TypeError('Failed to fetch (offline)');
      if (S.failRx.some(rx => rx.test(url))) throw new TypeError('Failed to fetch (simulated failure)');
      if (S.delay > 0) await new Promise(r => setTimeout(r, S.delay));
      return S.original.fetch(...args);
    };

    window.XMLHttpRequest = function() {
      const xhr = new S.original.XHR();
      const originalOpen = xhr.open;
      const originalSend = xhr.send;

      xhr.open = function(method, url) {
        this._url = url;
        return originalOpen.apply(this, arguments);
      };

      xhr.send = function(...args) {
        if (S.offline) {
          this.dispatchEvent(new Event('error'));
          this.status = 0;
          this.readyState = 4;
          this.responseText = '';
          this.onerror();
          return;
        }
        if (S.failRx.some(rx => rx.test(this._url))) {
          this.dispatchEvent(new Event('error'));
          this.status = 0;
          this.readyState = 4;
          this.responseText = '';
          this.onerror();
          return;
        }
        if (S.delay > 0) {
          setTimeout(() => originalSend.apply(this, args), S.delay);
        } else {
          originalSend.apply(this, args);
        }
      };
      return xhr;
    };
    S.patched = true;
  }

  // ================= Performance Section =================
  const secPerf = sec('🟧 Performance');
  const rPerf = row();
  const fpsBtn = btn('FPS', ()=> toggleFPS());
  const clsBtn = btn('CLS', ()=> toggleCLS());
  const longTasksBtn = btn('Long Tasks', ()=> toggleLongTasks());
  rPerf.append(
    fpsBtn,
    clsBtn,
    longTasksBtn,
    btn('Congelar UI 3s', ()=> freezeUI(3000))
  );
  secPerf.append(rPerf);

  // Performance functions
  function toggleFPS() {
    const id = '__qaFpsV50';
    let el = document.getElementById(id);
    if (el) { el.remove(); fpsBtn.classList.remove('active'); showToast('FPS Monitor: OFF'); return; }

    el = document.createElement('div');
    el.id = id;
    Object.assign(el.style, {
      position: 'fixed', top: '10px', left: '10px', zIndex: '2147483647',
      background: 'rgba(0,0,0,0.7)', color: 'lime', padding: '4px 8px',
      borderRadius: '4px', fontSize: '10px', fontFamily: 'monospace'
    });
    document.body.appendChild(el);
    fpsBtn.classList.add('active');
    showToast('FPS Monitor: ON');

    let frames = 0;
    let lastTime = performance.now();
    function updateFPS() {
      frames++;
      const now = performance.now();
      if (now > lastTime + 1000) {
        const fps = Math.round((frames * 1000) / (now - lastTime));
        el.textContent = `FPS: ${fps}`;
        frames = 0;
        lastTime = now;
      }
      S.raf = requestAnimationFrame(updateFPS);
    }
    S.raf = requestAnimationFrame(updateFPS);
  }

  function toggleCLS() {
    const id = '__qaClsV50';
    let el = document.getElementById(id);
    if (el) { S.obs.find(o=>o.id===id)?.disconnect(); S.obs = S.obs.filter(o=>o.id!==id); el.remove(); clsBtn.classList.remove('active'); showToast('CLS Monitor: OFF'); return; }

    el = document.createElement('div');
    el.id = id;
    Object.assign(el.style, {
      position: 'fixed', top: '40px', left: '10px', zIndex: '2147483647',
      background: 'rgba(0,0,0,0.7)', color: 'yellow', padding: '4px 8px',
      borderRadius: '4px', fontSize: '10px', fontFamily: 'monospace'
    });
    document.body.appendChild(el);
    clsBtn.classList.add('active');
    showToast('CLS Monitor: ON');

    let cls = 0;
    const observer = new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        if (!entry.hadRecentInput) {
          cls += entry.value;
          el.textContent = `CLS: ${cls.toFixed(4)}`;
        }
      }
    });
    observer.observe({ type: 'layout-shift', buffered: true });
    S.obs.push(Object.assign(observer, {id}));
    el.textContent = `CLS: ${cls.toFixed(4)}`;
  }

  function toggleLongTasks() {
    const id = '__qaLongTasksV50';
    let el = document.getElementById(id);
    if (el) { S.obs.find(o=>o.id===id)?.disconnect(); S.obs = S.obs.filter(o=>o.id!==id); el.remove(); longTasksBtn.classList.remove('active'); showToast('Long Tasks Monitor: OFF'); return; }

    el = document.createElement('div');
    el.id = id;
    Object.assign(el.style, {
      position: 'fixed', top: '70px', left: '10px', zIndex: '2147483647',
      background: 'rgba(0,0,0,0.7)', color: 'orange', padding: '4px 8px',
      borderRadius: '4px', fontSize: '10px', fontFamily: 'monospace'
    });
    document.body.appendChild(el);
    longTasksBtn.classList.add('active');
    showToast('Long Tasks Monitor: ON');

    let longTaskCount = 0;
    const observer = new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        if (entry.duration > 50) { // Long task is usually > 50ms
          longTaskCount++;
          el.textContent = `Long Tasks: ${longTaskCount}`;
          console.warn('[QA Menu] Long Task detected:', entry);
        }
      }
    });
    observer.observe({ type: 'longtask', buffered: true });
    S.obs.push(Object.assign(observer, {id}));
    el.textContent = `Long Tasks: ${longTaskCount}`;
  }

  function freezeUI(ms) {
    showToast(`Congelando UI por ${ms/1000} segundos...`);
    const start = performance.now();
    while (performance.now() - start < ms) {
      // Busy-wait to freeze UI
    }
    showToast('UI descongelada.');
  }

  // ================= Responsivo Section =================
  const secResp = sec('🟨 Responsivo');
  const rResp = row();
  const gridBtn = btn('Grid', ()=> toggleGrid());
  const viewportHudBtn = btn('Viewport HUD', ()=> toggleViewportHUD());
  rResp.append(
    gridBtn,
    viewportHudBtn
  );
  secResp.append(rResp);

  // Responsive functions
  function toggleGrid() {
    const id = '__qaGridV50';
    let el = document.getElementById(id);
    if (el) { el.remove(); gridBtn.classList.remove('active'); showToast('Grid: OFF'); return; }

    el = document.createElement('div');
    el.id = id;
    Object.assign(el.style, {
      position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
      backgroundImage: 'linear-gradient(to right, rgba(255,0,0,0.1) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,0,0,0.1) 1px, transparent 1px)',
      backgroundSize: '10px 10px', pointerEvents: 'none', zIndex: '999999999'
    });
    document.body.appendChild(el);
    gridBtn.classList.add('active');
    showToast('Grid: ON');
  }

  function toggleViewportHUD() {
    const id = '__qaViewportHUDv50';
    let el = document.getElementById(id);
    if (el) { el.remove(); viewportHudBtn.classList.remove('active'); showToast('Viewport HUD: OFF'); return; }

    el = document.createElement('div');
    el.id = id;
    Object.assign(el.style, {
      position: 'fixed', bottom: '10px', right: '10px', zIndex: '2147483647',
      background: 'rgba(0,0,0,0.7)', color: 'white', padding: '4px 8px',
      borderRadius: '4px', fontSize: '10px', fontFamily: 'monospace'
    });
    document.body.appendChild(el);
    viewportHudBtn.classList.add('active');
    showToast('Viewport HUD: ON');

    function updateViewportInfo() {
      el.textContent = `W: ${window.innerWidth}px H: ${window.innerHeight}px D: ${window.devicePixelRatio.toFixed(2)}`;
    }
    window.addEventListener('resize', updateViewportInfo);
    updateViewportInfo();
  }

  // ================= Segurança+ Section =================
  const secSec = sec('🛡️ Segurança+');
  const rTgt = row();
  const tgtLbl = document.createElement('span'); tgtLbl.textContent='Alvo: (nenhum)'; tgtLbl.style.color='#bbb';
  rTgt.append(
    btn('Selecionar campo alvo', ()=>{
      showToast('Clique em um campo/elemento para defini-lo como ALVO.');
      const once = (e)=>{ e.preventDefault(); e.stopPropagation(); S.target=e.target; tgtLbl.textContent = `Alvo: ${S.target.tagName.toLowerCase()}#${S.target.id||'-'}`; document.removeEventListener('click', once, true); };
      document.addEventListener('click', once, true);
    }),
    tgtLbl
  );
  const rSec1 = row();
  const sinksBtn = btn('Monitor DOM sinks', ()=> toggleSinks());
  const cspBtn = btn('CSP violations', ()=> toggleCSP());
  const evalMonitorBtn = btn('Monitor eval/Function', ()=> toggleEvalMonitor());
  rSec1.append(
    sinksBtn,
    cspBtn,
    evalMonitorBtn,
    btn('Teste Clickjacking', ()=> testClickjacking())
  );
  const rSec2 = row();
  rSec2.append(
    btn('Cookies expostos', ()=> auditCookies()),
    btn('Detectar/Decodificar JWT', ()=> auditJWT())
  );
  const rSec3 = row();
  rSec3.append(
    btn('Encontrar open‑redirect', ()=> findOpenRedirectParams()),
    btn('Testar 5 open‑redirects', ()=> testOpenRedirectSample(5))
  );
  const rSec4 = row();
  rSec4.append(
    btn('XSS seguro (marcador)', ()=> runXSS({active:false})),
    btn('XSS ATIVO ⚠️', ()=> { if(confirm('Rodar payloads ativos (alert)? Use somente em ambiente controlado.')) runXSS({active:true}); }),
    btn('SQLi no alvo', ()=> runSQLi({scope:'target'})),
    btn('SQLi em todos', ()=> runSQLi({scope:'all'})),
    btn('Enviar form do alvo', ()=> submitNearestForm()),
  );
  secSec.append(rTgt, rSec1, rSec2, rSec3, rSec4);

  // Security functions
  function toggleSinks() {
    if (S.sinksOn) {
      S.obs.find(o=>o.id==='__qaSinksV50')?.disconnect(); S.obs = S.obs.filter(o=>o.id!=='__qaSinksV50');
      sinksBtn.classList.remove('active');
      showToast('DOM Sinks Monitor: OFF');
      S.sinksOn = false;
      return;
    }
    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Check for common DOM XSS sinks
              if (node.innerHTML.includes('<script') || node.outerHTML.includes('javascript:')) {
                console.warn('[QA Menu][DOM Sink] Potencial XSS via innerHTML/outerHTML:', node);
                showToast('Potencial DOM Sink detectado! Veja console.');
              }
              if (node.src && node.src.startsWith('javascript:')) {
                console.warn('[QA Menu][DOM Sink] Potencial XSS via src=javascript:', node);
                showToast('Potencial DOM Sink detectado! Veja console.');
              }
            }
          });
        }
        if (mutation.type === 'attributes' && (mutation.attributeName === 'src' || mutation.attributeName === 'href')) {
          if (mutation.target.src && mutation.target.src.startsWith('javascript:')) {
            console.warn('[QA Menu][DOM Sink] Potencial XSS via attribute src=javascript:', mutation.target);
            showToast('Potencial DOM Sink detectado! Veja console.');
          }
          if (mutation.target.href && mutation.target.href.startsWith('javascript:')) {
            console.warn('[QA Menu][DOM Sink] Potencial XSS via attribute href=javascript:', mutation.target);
            showToast('Potencial DOM Sink detectado! Veja console.');
          }
        }
      });
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['src', 'href'] });
    S.obs.push(Object.assign(observer, {id:'__qaSinksV50'}));
    sinksBtn.classList.add('active');
    showToast('DOM Sinks Monitor: ON');
    S.sinksOn = true;
  }

  function toggleCSP() {
    if (S.cspOn) {
      window.removeEventListener('securitypolicyviolation', handleCSPViolation);
      cspBtn.classList.remove('active');
      showToast('CSP Monitor: OFF');
      S.cspOn = false;
      return;
    }
    window.addEventListener('securitypolicyviolation', handleCSPViolation);
    cspBtn.classList.add('active');
    showToast('CSP Monitor: ON');
    S.cspOn = true;
  }

  function handleCSPViolation(e) {
    console.warn('[QA Menu][CSP Violation]', e);
    showToast(`CSP Violation: ${e.violatedDirective}. Veja console.`);
  }

  function toggleEvalMonitor() {
    if (S.evalOn) {
      window.eval = S.original.eval;
      window.Function = S.original.Function;
      evalMonitorBtn.classList.remove('active');
      showToast('Eval/Function Monitor: OFF');
      S.evalOn = false;
      return;
    }

    window.eval = function(...args) {
      console.warn('[QA Menu][Eval Monitor] eval() called:', args[0]);
      showToast('eval() detectado! Veja console.');
      return S.original.eval.apply(this, args);
    };
    window.Function = function(...args) {
      console.warn('[QA Menu][Eval Monitor] Function() constructor called:', args[args.length - 1]);
      showToast('Function() constructor detectado! Veja console.');
      return S.original.Function.apply(this, args);
    };
    evalMonitorBtn.classList.add('active');
    showToast('Eval/Function Monitor: ON');
    S.evalOn = true;
  }

  function testClickjacking() {
    // Simple heuristic: check if the page is framed and if it can break out
    if (window.self !== window.top) {
      showToast('Página está em um iframe. Tentando quebrar o frame...');
      try {
        window.top.location = window.self.location;
      } catch (e) {
        console.warn('[QA Menu][Clickjacking] Não foi possível quebrar o frame (possível proteção):', e);
        showToast('Não foi possível quebrar o frame (possível proteção contra Clickjacking).');
      }
    } else {
      showToast('Página não está em um iframe. Clickjacking não aplicável diretamente.');
    }
  }

  function auditCookies() {
    const cookies = document.cookie.split(';').map(c => c.trim()).filter(Boolean);
    const exposed = cookies.map(c => {
      const [name, value] = c.split('=');
      return { name, value, httpOnly: '?', secure: '?', sameSite: '?' }; // Cannot determine HttpOnly, Secure, SameSite from JS
    });
    console.table(exposed);
    showToast(`${exposed.length} cookie(s) exposto(s) via JS. Veja console para detalhes (HttpOnly, Secure, SameSite não detectáveis via JS).`);
  }

  function auditJWT() {
    const tokens = [];
    // Search in localStorage, sessionStorage, and cookies
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      const value = localStorage.getItem(key);
      if (typeof value === 'string' && value.match(/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/)) {
        tokens.push({ source: 'localStorage', key, value, decoded: decodeJWT(value) });
      }
    }
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      const value = sessionStorage.getItem(key);
      if (typeof value === 'string' && value.match(/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/)) {
        tokens.push({ source: 'sessionStorage', key, value, decoded: decodeJWT(value) });
      }
    }
    document.cookie.split(';').forEach(c => {
      const [name, value] = c.trim().split('=');
      if (typeof value === 'string' && value.match(/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/)) {
        tokens.push({ source: 'cookie', key: name, value, decoded: decodeJWT(value) });
      }
    });

    if (tokens.length > 0) {
      console.table(tokens);
      showToast(`${tokens.length} JWT(s) detectado(s) e decodificado(s). Veja console.`);
    } else {
      showToast('Nenhum JWT detectado.');
    }
  }

  function decodeJWT(token) {
    try {
      const parts = token.split('.');
      const header = JSON.parse(atob(parts[0]));
      const payload = JSON.parse(atob(parts[1]));
      return { header, payload };
    } catch (e) {
      return { error: 'Falha ao decodificar JWT', details: e.message };
    }
  }

  async function findOpenRedirectParams() {
    showToast('Buscando parâmetros de open-redirect...');
    const params = new Set();
    const url = new URL(window.location.href);
    url.searchParams.forEach((value, key) => {
      if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('//')) {
        params.add(key);
      }
    });
    // Also check common redirect parameter names
    const commonParams = ['redirect', 'url', 'next', 'destination', 'returnTo', 'continue'];
    commonParams.forEach(p => {
      if (url.searchParams.has(p)) {
        params.add(p);
      }
    });

    if (params.size > 0) {
      console.log('[QA Menu][Open Redirect] Parâmetros suspeitos:', Array.from(params));
      showToast(`Parâmetros de open-redirect suspeitos encontrados: ${Array.from(params).join(', ')}. Veja console.`);
    } else {
      showToast('Nenhum parâmetro de open-redirect suspeito encontrado.');
    }
  }

  async function testOpenRedirectSample(count = 5) {
    showToast(`Testando ${count} open-redirects de exemplo...`);
    const testUrls = [
      'https://www.google.com',
      'https://www.bing.com',
      'https://example.com',
      'data:text/html,<script>alert(\'XSS\')</script>', // XSS via data URI
      'javascript:alert(\'XSS\')' // XSS via javascript URI
    ];
    const url = new URL(window.location.href);
    const originalParams = Array.from(url.searchParams.keys()).filter(k => {
      const val = url.searchParams.get(k);
      return val.startsWith('http://') || val.startsWith('https://') || val.startsWith('//') || ['redirect', 'url', 'next', 'destination', 'returnTo', 'continue'].includes(k);
    });

    if (originalParams.length === 0) {
      showToast('Nenhum parâmetro de redirect detectado na URL atual para testar.');
      return;
    }

    for (const param of originalParams) {
      for (let i = 0; i < Math.min(count, testUrls.length); i++) {
        const testUrl = testUrls[i];
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.set(param, testUrl);
        console.log(`[QA Menu][Open Redirect Test] Testando: ${newUrl.href}`);
        // Cannot programmatically check for redirect without navigating, which is disruptive.
        // User needs to manually check the console and network tab.
      }
    }
    showToast('Testes de open-redirect iniciados. Verifique o console e a aba Network para redirecionamentos.');
  }

  function runXSS({active=false}={}){
    const ts = Date.now();
    const targets = allInputs().filter(el => /^(text|search|url|email|tel|number|password)?$/i.test(el.type) || el.tagName==='TEXTAREA');
    if (!targets.length) { showToast('Nenhum campo elegível encontrado para XSS.'); return; }

    const safeMarker = `QA-XSS-TEST-${ts}`;
    const payloads = active ? [
      `"><script>alert('XSS ${ts}')</script>`,
      `javascript:alert('XSS ${ts}')`,
      `"><iframe srcdoc="<script>alert('XSS ${ts}')<\/script>">`
    ] : [ safeMarker, `"><qa-xss-${ts}/>`, `&lt;img src=x onerror=alert('XSS ${ts}')&gt;` ];

    for (const el of targets) {
      const p = payloads[Math.floor(Math.random()*payloads.length)];
      setVal(el, p); console.log('[QA][XSS]', {el, value:p, valid: el.checkValidity?.()});
    }
    showToast(`XSS ${active?'ATIVO':'SEGURO'} aplicado em ${targets.length} campo(s).`);
  }

  function runSQLi({scope='target'}={}){
    const probes = [
      `' OR 1=1 --`, `') OR '1'='1`, `admin' --`,
      `' UNION SELECT NULL--`, `abc'; DROP TABLE users;--`, `'; WAITFOR DELAY '0:0:2'--`
    ];
    const targets = (scope==='target' && S.target) ? [S.target] :
      allInputs().filter(el => /^(text|search|url|email|tel|number|password)?$/i.test(el.type) || el.tagName==='TEXTAREA');
    if (!targets.length) { showToast('Nenhum campo elegível encontrado para SQLi.'); return; }
    for (const el of targets) {
      const v = probes[Math.floor(Math.random()*probes.length)];
      setVal(el, v); console.warn('[QA][SQLi]', {el, value:v});
    }
    showToast(`SQLi probes aplicadas em ${targets.length} campo(s).`);
  }

  function submitNearestForm() {
    if (!S.target) { showToast('Selecione um ALVO primeiro para enviar o formulário.'); return; }
    const form = S.target.closest('form');
    if (form) {
      form.submit();
      showToast('Formulário mais próximo submetido.');
    } else {
      showToast('Nenhum formulário encontrado próximo ao alvo.');
    }
  }

  // ================= Auditorias UI/A11y Section =================
  const secAudit = sec('🔎 Auditorias UI/A11y');
  const rAu1 = row();
  rAu1.append(
    btn('IDs duplicados', ()=> auditDuplicateIds()),
    btn('Links quebrados (#id)', ()=> auditBrokenAnchors()),
    btn('Contraste rápido', ()=> auditContrastQuick())
  );
  const rAu2 = row();
  rAu2.append(
    btn('Truncamento de texto', ()=> highlightTruncation()),
    btn('Sobreposição de clique', ()=> highlightClickThrough())
  );
  secAudit.append(rAu1, rAu2);

  // UI/A11y Audit functions
  function auditDuplicateIds(){
    const ids = {};
    document.querySelectorAll('[id]').forEach(el=>{
      const id = el.id; ids[id] = ids[id] || []; ids[id].push(el);
    });
    executeInIframes(iframeDoc => {
      iframeDoc.querySelectorAll('[id]').forEach(el => {
        const id = el.id; ids[id] = ids[id] || []; ids[id].push(el);
      });
    });

    const dups = Object.entries(ids).filter(([id, list])=> list.length>1);
    console.table(dups.map(([id,list])=>({id, count:list.length, sample:list[0]})));
    showToast(`${dups.length} ID(s) duplicado(s). Veja Console.`);
  }

  function auditBrokenAnchors(){
    const set = new Set(Array.from(document.querySelectorAll('[id]')).map(el=>el.id));
    executeInIframes(iframeDoc => {
      Array.from(iframeDoc.querySelectorAll('[id]')).map(el => set.add(el.id));
    });

    const list = Array.from(document.querySelectorAll('a[href^="#"]')).map(a=>a.getAttribute('href').slice(1));
    executeInIframes(iframeDoc => {
      Array.from(iframeDoc.querySelectorAll('a[href^="#"]')).map(a => list.push(a.getAttribute('href').slice(1)));
    });

    const broken = list.filter(id=>id && !set.has(id));
    console.table(broken.map(id=>({id, href:'#'+id})));
    showToast(`${broken.length} anchor(s) sem destino. Veja Console.`);
  }

  function auditContrastQuick(){
    function parseColor(c){ const m=c.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i); if(!m) return [0,0,0]; return [Number(m[1]),Number(m[2]),Number(m[3])]; }
    function relLum([r,g,b]){ [r,g,b]=[r,g,b].map(v=>{ v/=255; return v<=0.03928? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); }); return 0.2126*r+0.7152*g+0.0722*b; }
    function ratio(fg,bg){ const L1=Math.max(relLum(fg),relLum(bg))+0.05; const L2=Math.min(relLum(fg),relLum(bg))+0.05; return L1/L2; }
    const items=[];

    function checkContrast(doc) {
      doc.querySelectorAll('*').forEach(el=>{
        const cs = getComputedStyle(el);
        if (!el.textContent || !el.offsetParent) return;
        const size = parseFloat(cs.fontSize||'0');
        const large = size>=18 || (size>=14 && (cs.fontWeight==='700'||parseInt(cs.fontWeight)>=700));
        const rr = ratio(parseColor(cs.color), parseColor(cs.backgroundColor||'rgb(255,255,255)'));
        const pass = rr >= (large?3:4.5);
        if (!pass) { el.__qaOldOutline=el.style.outline; el.style.outline='2px solid #ffc107'; items.push({el, ratio:rr.toFixed(2), size, large}); }
      });
    }
    checkContrast(document);
    executeInIframes(checkContrast);

    console.table(items.map(i=>({ratio:i.ratio, large:i.large, node:i.el})));
    showToast(`${items.length} elemento(s) com contraste possivelmente insuficiente (heurístico). Veja Console.`);
  }

  function highlightTruncation(){
    const nodes = [];
    function findTruncation(doc) {
      Array.from(doc.querySelectorAll('*')).filter(el=>{
        if (!el.firstChild || !el.textContent || !el.offsetParent) return false;
        const cs = getComputedStyle(el);
        const cond = (cs.overflow!=='visible' || cs.textOverflow==='ellipsis');
        return cond && el.scrollWidth - 1 > el.clientWidth;
      }).forEach(el => nodes.push(el));
    }
    findTruncation(document);
    executeInIframes(findTruncation);

    nodes.forEach(el=>{ el.__qaOldOutline = el.style.outline; el.style.outline='2px solid #e91e63'; });
    showToast(`Possível truncamento em ${nodes.length} elemento(s).`);
  }

  function highlightClickThrough(){
    const nodes = [];
    let count=0;

    function findClickThrough(doc) {
      Array.from(doc.querySelectorAll('a,button,[role="button"],[onclick]')).forEach(el=>{
        const r = el.getBoundingClientRect(); if (r.width<6 || r.height<6) return;
        const cx = r.left + r.width/2, cy = r.top + r.height/2;
        const topEl = doc.elementFromPoint(cx, cy);
        if (topEl && topEl !== el && !el.contains(topEl)) {
          nodes.push(el);
          count++;
        }
      });
    }
    findClickThrough(document);
    executeInIframes(findClickThrough);

    nodes.forEach(el=>{ el.__qaOldOutline = el.style.outline; el.style.outline='2px solid #ff5722'; });
    showToast(`Possíveis sobreposições de clique: ${count}.`);
  }

  // ================= UX – Validações Section =================
  const secUX = sec('🎨 UX – Validações');
  const rUX0 = row();
  const uxLbl = document.createElement('span'); uxLbl.textContent = 'Seção alvo: (nenhuma)'; uxLbl.style.color='#bbb';
  rUX0.append(
    btn('Selecionar título/label da seção', ()=>{
      showToast('Clique no título/label da SEÇÃO (ex.: "Dados Pessoa Jurídica").');
      const once = (e)=>{ e.preventDefault(); e.stopPropagation(); S.uxSection = e.target; uxLbl.textContent = 'Seção alvo: ' + (S.uxSection.textContent||S.uxSection.id||S.uxSection.tagName); document.removeEventListener('click', once, true); };
      document.addEventListener('click', once, true);
    }),
    uxLbl
  );
  const rUX1 = row();
  rUX1.append(
    btn('Detectar órfãos PRÓXIMOS à seção', ()=> detectOrphansNearSection()),
    btn('Varredura geral de órfãos', ()=> scanOrphanFields()),
    btn('Sem rótulo (acessível)', ()=> scanUnlabeled())
  );
  const rUX2 = row();
  rUX2.append(
    btn('Sem "name" (não submetidos)', ()=> scanNoNameInsideForm()),
    btn('Focáveis INVISÍVEIS', ()=> scanFocusableInvisible()),
    btn('Limpar marcações', ()=> uxClearMarks())
  );
  secUX.append(rUX0, rUX1, rUX2, hint('Marcação: magenta = órfão; azul = sem rótulo; laranja = focável invisível; ciano = sem "name". Detalhes no Console.'));

  // UX Validation functions
  function detectOrphansNearSection(){
    if (!S.uxSection) { showToast('Selecione antes o título/label da seção.'); return; }
    uxClearMarks();
    const ctrls = controlsAround(S.uxSection, {hDist: 500, vTol: 60});
    const findings = [];
    for (const el of ctrls) {
      const name = accName(el);
      const empty = (el.value||'').length===0;
      const optional = !el.required;
      const noName = !el.name && !!el.closest('form');
      const nearIsLabel = !!(el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`));
      const wrappedLabel = !!el.closest('label');
      const labeled = !!(name || nearIsLabel || wrappedLabel);
      const suspicious = (empty && optional && !labeled) || noName;
      if (suspicious) {
        mark(el, '#ff00ff'); // magenta
        findings.push({motivo: (noName?'sem name':'vazio/opcional/sem rótulo'), el, accName: name});
      }
    }
    console.table(findings);
    showToast(`Analisados ${ctrls.length} controle(s) próximos. Sinalizados: ${findings.length}. Veja Console.`);
  }

  function scanOrphanFields(){
    uxClearMarks();
    const items = [];
    const processDoc = (doc) => {
      const headings = Array.from(doc.querySelectorAll('h1,h2,h3,h4,h5,h6,legend,th,dt,strong,b,label'))
        .filter(visible)
        .concat(Array.from(doc.querySelectorAll('span,div,p')).filter(el=> visible(el) && likelyHeading(el)));
      const seen = new Set();
      for (const h of headings) {
        controlsAround(h, {hDist:480, vTol:48}).forEach(el=>{
          if (seen.has(el)) return; seen.add(el);
          const name = accName(el);
          const empty = (el.value||'').length===0;
          const optional = !el.required;
          const noName = !el.name && !!el.closest('form');
          const labeled = !!name || !!(el.id && doc.querySelector(`label[for="${CSS.escape(el.id)}"]`)) || !!el.closest('label');
          const suspicious = (empty && optional && !labeled) || noName;
          if (suspicious) {
            mark(el, '#ff00ff');
            items.push({titulo: (h.textContent||'').trim().slice(0,60), motivo: (noName?'sem name':'vazio/opcional/sem rótulo'), node: el});
          }
        });
      }
    };
    processDoc(document);
    executeInIframes(processDoc);

    console.table(items);
    showToast(`Órfãos (heurístico): ${items.length}. Veja detalhes no Console.`);
  }

  function scanUnlabeled(){
    uxClearMarks();
    const bad = [];
    const processDoc = (doc) => {
      Array.from(doc.querySelectorAll('input,textarea,select')).filter(visible)
        .filter(el => !accName(el))
        .forEach(el => bad.push(el));
    };
    processDoc(document);
    executeInIframes(processDoc);

    bad.forEach(el=> mark(el, '#2196f3')); // azul
    console.table(bad.map(el=>({tag:el.tagName.toLowerCase(), id:el.id, name:el.name})));
    showToast(`Sem rótulo acessível: ${bad.length}.`);
  }

  function scanNoNameInsideForm(){
    uxClearMarks();
    const list = [];
    const processDoc = (doc) => {
      Array.from(doc.querySelectorAll('form input, form textarea, form select'))
        .filter(visible)
        .filter(el => !el.name)
        .forEach(el => list.push(el));
    };
    processDoc(document);
    executeInIframes(processDoc);

    list.forEach(el=> mark(el, '#00bcd4')); // ciano
    console.table(list.map(el=>({form: el.form?.action || '(inline)', tag:el.tagName.toLowerCase(), id:el.id})));
    showToast(`Controles de formulário SEM "name": ${list.length}.`);
  }

  function scanFocusableInvisible(){
    uxClearMarks();
    const bad = [];
    const processDoc = (doc) => {
      const all = Array.from(doc.querySelectorAll('*')).filter(isFocusable);
      all.filter(el => !visible(el)).forEach(el => bad.push(el));
    };
    processDoc(document);
    executeInIframes(processDoc);

    bad.forEach(el=> mark(el, '#ff9800')); // laranja
    console.table(bad.map(el=>({tag:el.tagName.toLowerCase(), id:el.id, clazz:el.className})));
    showToast(`Focáveis invisíveis: ${bad.length}.`);
  }

  // ================= i18n & Conteúdo Section =================
  const secI18n = sec('🌍 i18n & Conteúdo');
  const rI1 = row();
  rI1.append(
    btn('Preencher texto LONGO', ()=> fillLongText()),
    btn('Aplicar RTL/Bidi', ()=> applyRTL()),
    btn('Preencher com Emoji', ()=> fillEmoji())
  );
  secI18n.append(rI1);

  // i18n functions
  function fillLongText(){
    const targets = allInputs().filter(el => ['text','search','email','password','tel','url','textarea',''].includes((el.type||'').toLowerCase()) || el.tagName==='TEXTAREA');
    const long = 'L'.repeat(400) + ' fim';
    targets.forEach(el=> setVal(el, long));
    showToast(`Texto longo aplicado em ${targets.length} campo(s).`);
  }

  function applyRTL(){
    document.documentElement.dir = (document.documentElement.dir==='rtl'?'ltr':'rtl');
    showToast(`Direção do documento: ${document.documentElement.dir.toUpperCase()}`);
  }

  function fillEmoji(){
    const targets = allInputs().filter(el => ['text','search','email','password','tel','url','textarea',''].includes((el.type||'').toLowerCase()) || el.tagName==='TEXTAREA');
    const txt = '👩🏽‍💻🚀🔥✨ — qa‑emoji‑🧪';
    targets.forEach(el=> setVal(el, txt));
    showToast(`Emoji aplicado em ${targets.length} campo(s).`);
  }

  // ================= Fluxo & Rede Section =================
  const secFlow = sec('⚙️ Fluxo & Rede');
  const rF1 = row();
  const burstUrl = input('text', location.origin, '190px');
  const burstQty = input('number','10','64px'); burstQty.min='1'; burstQty.step='1';
  rF1.append(
    label('URL:', burstUrl),
    label('N:', burstQty),
    btn('Burst GET', ()=> burstRequests(burstUrl.value, Number(burstQty.value||'10')))
  );
  const rF2 = row();
  const spamN = input('number','15','64px'); spamN.min='1'; spamN.step='1';
  rF2.append(
    label('Spam‑click N:', spamN),
    btn('Rodar no ALVO', ()=> spamClick(Number(spamN.value||'15')))
  );
  secFlow.append(rF1, rF2);

  // Flow & Network functions
  function spamClick(n=15, delay=50){
    const el = S.target;
    if (!el){ showToast('Selecione um ALVO primeiro.'); return; }
    let i=0; const id=setInterval(()=>{ try{ el.click(); }catch{} i++; if(i>=n) clearInterval(id); }, Math.max(0,delay));
    showToast(`Spam-click iniciado no alvo (${n} cliques).`);
  }

  async function burstRequests(url, n=10){
    if (!/^https?:/i.test(url)) { try{ url = new URL(url, location.href).href; }catch{ showToast('URL inválida.'); return; } }
    showToast(`Iniciando Burst GET para ${n} requisições...`);
    const t0=performance.now();
    const ps = Array.from({length:n}).map((_,i)=> fetch(url, {cache:'no-store'}).then(r=>({i, status:r.status})).catch(e=>({i, status:'ERR'})));
    const res = await Promise.all(ps);
    console.table(res);
    showToast(`Burst concluído (${n} req). Tempo total ~${Math.round(performance.now()-t0)}ms. Veja Console.`);
  }

  // ================= Storage / SW / Cache Section =================
  const secSW = sec('🧰 Storage / SW / Cache');
  const rSW1 = row();
  rSW1.append(
    btn('Listar SW', ()=> listSW()),
    btn('Unregister SW', ()=> unregisterSW()),
    btn('Limpar Cache Storage', ()=> clearCaches()),
    btn('Limpar local+session', ()=> clearStorage())
  );
  const rSW2 = row();
  const quotaMB = input('number','5','64px'); quotaMB.min='1'; quotaMB.step='1';
  rSW2.append(
    label('Preencher localStorage (MB):', quotaMB),
    btn('Executar', ()=> fillLocalStorageMB(Number(quotaMB.value||'5'))),
    btn('Limpar cookies (JS)', ()=> clearJsCookies())
  );
  secSW.append(rSW1, rSW2, hint('Cookies HttpOnly não podem ser removidos via JS (use Application → Cookies).'));

  // Storage functions
  async function listSW(){ if(!('serviceWorker' in navigator)){ showToast('Service Worker não suportado.'); return; }
    const regs = await navigator.serviceWorker.getRegistrations();
    console.table(regs.map(r=>({scope:r.scope, active:!!r.active, installing:!!r.installing, waiting:!!r.waiting})));
    showToast(`${regs.length} registration(s). Veja o Console.`);
  }
  async function unregisterSW(){ if(!('serviceWorker' in navigator)){ showToast('Service Worker não suportado.'); return; }
    const regs = await navigator.serviceWorker.getRegistrations(); await Promise.all(regs.map(r=>r.unregister())); showToast(`Service Workers desregistrados: ${regs.length}`); }
  async function clearCaches(){ if(!('caches' in window)){ showToast('Cache Storage não suportado.'); return; }
    const keys = await caches.keys(); await Promise.all(keys.map(k=>caches.delete(k))); showToast(`Cache Storage limpo (${keys.length}).`); }
  function clearStorage(){ try{ localStorage.clear(); sessionStorage.clear(); showToast('localStorage + sessionStorage limpos.'); }catch(e){ showToast('Falha ao limpar storage: ' + e.message); console.error('[QA Menu] Falha ao limpar storage:', e); } }
  function fillLocalStorageMB(mb=5){
    try{
      const key='__qa_fill__'; const chunk='X'.repeat(1024*1024); let data=''; for(let i=0;i<mb;i++) data+=chunk;
      localStorage.setItem(key, data); showToast(`Gravou ~${mb}MB em localStorage (chave ${key}). Remova depois em Application → Local Storage.`);
    }catch(e){ showToast('Falhou ao preencher localStorage: '+(e.message||e)); console.error('[QA Menu] Falha ao preencher localStorage:', e); }
  }
  function clearJsCookies(){
    const list = (document.cookie || '').split(';').map(s=>s.trim()).filter(Boolean);
    let count = 0;
    list.forEach(pair => {
      const name = pair.split('=')[0];
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
      count++;
    });
    showToast(`Tentou remover ${count} cookie(s) acessíveis por JS (variações de path/domain podem permanecer).`);
  }

  // ================= Cleanup =================
  function destroy(){
    try{
      // Restore network & eval monitors
      window.fetch = S.original.fetch;
      window.XMLHttpRequest = S.original.XHR;
      window.eval = S.original.eval;
      window.Function = S.original.Function;
      // sinks & csp
      if (S.sinksOn) toggleSinks();
      if (S.cspOn) toggleCSP();
      if (S.evalOn) toggleEvalMonitor();
      // observers & RAF
      S.obs.forEach(o=>o.disconnect()); S.obs=[];
      cancelAnimationFrame(S.raf);
      // overlays & styles
      ['__qaFpsV50','__qaClsV50','__qaGridV50','__qaViewportHUDv50'].forEach(id=>document.getElementById(id)?.remove());
      document.documentElement.classList.remove('__qaOutlineV50');
      document.getElementById('__qaOutlineStyleV50')?.remove();
      uxClearMarks();
      // restore field values
      S.snapshots.clear();
      // HUD
      host.remove();
      console.log('[QA V5.0] Cleanup concluído.');
    } finally { delete window.__qaHUDv50; }
  }
  window.__qaHUDv50 = { destroy };

  // Append sections to the body
  bd.append(secUI, secAPI, secPerf, secResp, secSec, secAudit, secUX, secI18n, secFlow, secSW);

  // Initial state for toggle buttons
  if (document.documentElement.classList.contains('__qaOutlineV50')) outlineBtn.classList.add('active');
  if (S.patched) patchNetworkBtn.classList.add('active');
  if (S.offline) offlineBtn.classList.add('active');
  if (S.sinksOn) sinksBtn.classList.add('active');
  if (S.cspOn) cspBtn.classList.add('active');
  if (S.evalOn) evalMonitorBtn.classList.add('active');

})();
