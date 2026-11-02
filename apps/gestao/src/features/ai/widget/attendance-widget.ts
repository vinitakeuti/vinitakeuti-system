/**
 * Widget de atendimento com IA para o site (viniciusriudi.com), servido pela gestão em /widget/atendimento.js.
 * O site só inclui:
 *   <script src="https://gestao.viniciusriudi.com/widget/atendimento.js" defer></script>
 * Opcional: data-label="Fale comigo" (texto do botão) e data-tema="escuro" (botão verde, para sites de fundo escuro).
 *
 * JavaScript puro, isolado em Shadow DOM (o CSS do site não interfere, nem o dele no site). O botão só aparece com o
 * canal Site liberado em Integrações. Para conversar, o visitante informa nome, telefone e e-mail. A sessão fica no
 * localStorage, então a conversa continua se a página for recarregada.
 *
 * Mantido como texto (não passa pelo bundler): sem crases nem interpolação no código abaixo.
 */
export const ATTENDANCE_WIDGET_SOURCE = String.raw`(function () {
  "use strict";
  if (window.__vrAtendimento) return;
  window.__vrAtendimento = true;

  var script = document.currentScript;
  var ORIGIN = script && script.src ? new URL(script.src).origin : "";
  var API = ORIGIN + "/api/ia/site";
  var LOGO = ORIGIN + "/assets/images/email-logo.png";
  var LABEL = (script && script.getAttribute("data-label")) || "Fale comigo";
  var DARK = script && script.getAttribute("data-tema") === "escuro";
  var STORE = "vr-atendimento";
  var POLL_MS = 1200;
  var MAX_POLL_MS = 120000;

  function load() { try { return JSON.parse(localStorage.getItem(STORE) || "{}"); } catch (e) { return {}; } }
  function save(data) { try { localStorage.setItem(STORE, JSON.stringify(data)); } catch (e) {} }
  function newSession() {
    var bytes = new Uint8Array(18);
    (window.crypto || window.msCrypto).getRandomValues(bytes);
    return "s" + Array.prototype.map.call(bytes, function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
  }
  var state = load();
  if (!state.sessionId || !/^[A-Za-z0-9_-]{16,64}$/.test(state.sessionId)) { state.sessionId = newSession(); save(state); }

  function request(method, path, body) {
    return fetch(API + path, { method: method, headers: body ? { "content-type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined, credentials: "omit" })
      .then(function (response) { return response.json().catch(function () { return {}; }).then(function (data) { data.__status = response.status; return data; }); });
  }

  var CSS = [
    ":host{all:initial}",
    "*{box-sizing:border-box}",
    "[hidden]{display:none!important}",
    ".vr{--ink:#111;--black:#000;--accent:#4b6156;--accent-soft:#f0f4f1;--line:#d9ded9;--muted:#666b66;--paper:#f5f6f4;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif;color:var(--ink);-webkit-font-smoothing:antialiased}",
    ".mono{font-family:'JetBrains Mono','SFMono-Regular',Menlo,Consolas,monospace}",
    ".launcher{position:fixed;right:20px;bottom:20px;z-index:2147483000;display:flex;align-items:center;gap:10px;height:52px;padding:0 18px 0 14px;border:1px solid var(--black);background:var(--black);color:#fff;font-size:11px;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;box-shadow:0 10px 30px rgba(0,0,0,.18);transition:transform .15s ease,background .15s ease}",
    ".launcher:hover{background:var(--accent);border-color:var(--accent)}",
    ".launcher:focus-visible,.panel button:focus-visible,.panel input:focus-visible,.panel textarea:focus-visible{outline:2px solid var(--accent);outline-offset:2px}",
    ".launcher svg{width:22px;height:22px;flex:0 0 auto}",
    ".launcher .dot{width:7px;height:7px;background:#8fd1a6;flex:0 0 auto}",
    ".launcher.is-open{transform:translateY(8px);opacity:0;pointer-events:none}",
    ".vr.dark .launcher{background:var(--accent);border-color:var(--accent);box-shadow:0 10px 30px rgba(0,0,0,.5)}",
    ".vr.dark .launcher:hover{background:#fff;border-color:#fff;color:var(--black)}",
    ".vr.dark .panel{border-color:#2e2e2e;box-shadow:0 18px 60px rgba(0,0,0,.6)}",
    ".panel{position:fixed;right:20px;bottom:20px;z-index:2147483001;display:flex;flex-direction:column;width:380px;height:min(620px,calc(100vh - 40px));border:1px solid var(--black);background:#fff;box-shadow:0 18px 50px rgba(0,0,0,.22);opacity:0;transform:translateY(12px);pointer-events:none;transition:opacity .18s ease,transform .18s ease}",
    ".panel.is-open{opacity:1;transform:none;pointer-events:auto}",
    ".head{display:flex;align-items:center;gap:12px;padding:16px 16px 14px;background:var(--black);color:#fff;border-bottom:3px solid var(--accent)}",
    ".head .mark{width:38px;height:29px;display:block;object-fit:contain}",
    ".head .who{flex:1;min-width:0;display:grid;gap:3px}",
    ".head b{font-size:14px;font-weight:650;letter-spacing:-.01em}",
    ".head small{display:flex;align-items:center;gap:6px;color:#b9bdb8;font-size:10px;letter-spacing:.08em;text-transform:uppercase}",
    ".head small i{width:6px;height:6px;background:#8fd1a6;display:inline-block}",
    ".close{width:34px;height:34px;display:grid;place-items:center;border:1px solid #3a3d3b;background:transparent;color:#fff;cursor:pointer}",
    ".close:hover{border-color:#fff}",
    ".close svg{width:14px;height:14px}",
    ".body{flex:1;min-height:0;overflow-y:auto;padding:20px 18px;scrollbar-width:thin}",
    ".intro h2{margin:0 0 6px;font-size:20px;line-height:1.2;letter-spacing:-.03em}",
    ".intro p{margin:0 0 18px;color:var(--muted);font-size:13px;line-height:1.55}",
    "form.lead{display:grid;gap:12px}",
    "label{display:grid;gap:6px;color:var(--muted);font-size:10px;letter-spacing:.07em;text-transform:uppercase}",
    "input,textarea{width:100%;border:1px solid #c5cbc6;border-radius:0;background:#fff;color:var(--ink);font:inherit;font-size:14px;letter-spacing:0;text-transform:none;padding:11px 12px;outline:none}",
    "input:focus,textarea:focus{border-color:var(--black)}",
    "input[aria-invalid=true]{border-color:#8c4427;background:#fbf2ef}",
    ".primary{height:46px;border:1px solid var(--black);background:var(--black);color:#fff;font-size:11px;letter-spacing:.08em;text-transform:uppercase;cursor:pointer}",
    ".primary:hover{background:var(--accent);border-color:var(--accent)}",
    ".primary:disabled{opacity:.4;cursor:default}",
    ".legal{margin:2px 0 0;color:var(--muted);font-size:11px;line-height:1.5}",
    ".error{margin:0;padding:9px 11px;border:1px solid #c9a191;background:#f8eeea;color:#8c4427;font-size:12px;line-height:1.45}",
    ".msgs{display:grid;gap:14px}",
    ".msg{display:grid;gap:4px;min-width:0}",
    ".msg.user{justify-items:end}",
    ".msg.user .bubble{max-width:85%;padding:10px 13px;background:var(--black);color:#fff;font-size:14px;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere}",
    ".msg.ai{grid-template-columns:26px minmax(0,1fr);gap:10px;align-items:start}",
    ".avatar{width:26px;height:26px;display:grid;place-items:center;background:var(--black)}",
    ".avatar img{width:16px;height:12px;display:block;object-fit:contain}",
    ".text{padding-top:3px;font-size:14px;line-height:1.6;color:#222522;overflow-wrap:anywhere}",
    ".text p{margin:0 0 8px}.text p:last-child{margin-bottom:0}",
    ".text ul{margin:0 0 8px;padding-left:18px}.text li{margin:2px 0}.text li::marker{color:var(--accent)}",
    ".text a{color:var(--accent)}",
    ".typing{display:flex;align-items:center;gap:10px;color:var(--muted);font-size:10px;letter-spacing:.07em;text-transform:uppercase}",
    ".typing .dots{display:inline-flex;gap:4px}.typing .dots i{width:5px;height:5px;background:var(--accent);animation:vrp 1.1s ease-in-out infinite}.typing .dots i:nth-child(2){animation-delay:.18s}.typing .dots i:nth-child(3){animation-delay:.36s}",
    "@keyframes vrp{0%,100%{opacity:.25}50%{opacity:1}}",
    "@media (prefers-reduced-motion:reduce){.typing .dots i{animation:none;opacity:.7}.panel,.launcher{transition:none}}",
    ".composer{display:flex;align-items:flex-end;gap:8px;padding:10px 12px;border-top:1px solid var(--line);background:#fff}",
    ".composer textarea{min-height:44px;max-height:140px;resize:none;line-height:1.45;padding:11px 12px}",
    ".composer .primary{height:44px;padding:0 14px}",
    ".foot{padding:7px 12px 9px;border-top:1px solid var(--line);color:#8a8f8a;font-size:9px;letter-spacing:.07em;text-transform:uppercase;text-align:center}",
    "@media (max-width:520px){.launcher{right:14px;bottom:14px;width:54px;height:54px;padding:0;justify-content:center}.launcher .label,.launcher .dot{display:none}.panel{inset:0;right:0;bottom:0;width:100%;height:100%;border:0}}"
  ].join("");

  var ICON_CHAT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M3 4h18v12H9l-5 4v-4H3z"/><path d="M7.5 9h9M7.5 12h6"/></svg>';
  var ICON_CLOSE = '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M2 2l10 10M12 2L2 12"/></svg>';

  function escapeHtml(text) { return String(text).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function inline(text) {
    return escapeHtml(text)
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, "$1<strong>$2</strong>")
      .replace(/(https?:\/\/[^\s<)]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
  }
  /** Markdown simples da resposta: parágrafos, listas com hífen e negrito. */
  function render(text) {
    var html = "", list = [];
    function flush() { if (list.length) { html += "<ul>" + list.map(function (item) { return "<li>" + inline(item) + "</li>"; }).join("") + "</ul>"; list = []; } }
    String(text).split(/\n{2,}/).forEach(function (block) {
      var lines = block.split("\n"), paragraph = [];
      lines.forEach(function (line) {
        var item = line.match(/^\s*[-*•]\s+(.+)$/);
        if (item) { if (paragraph.length) { html += "<p>" + paragraph.map(inline).join("<br>") + "</p>"; paragraph = []; } list.push(item[1]); }
        else { flush(); if (line.trim()) paragraph.push(line.replace(/^#+\s*/, "")); }
      });
      flush();
      if (paragraph.length) html += "<p>" + paragraph.map(inline).join("<br>") + "</p>";
    });
    return html;
  }

  function phoneMask(value) {
    var d = value.replace(/\D/g, "").slice(0, 11);
    if (d.length <= 2) return d ? "(" + d : "";
    if (d.length <= 6) return "(" + d.slice(0, 2) + ") " + d.slice(2);
    if (d.length <= 10) return "(" + d.slice(0, 2) + ") " + d.slice(2, 6) + "-" + d.slice(6);
    return "(" + d.slice(0, 2) + ") " + d.slice(2, 7) + "-" + d.slice(7);
  }

  function start() {
    var host = document.createElement("div");
    host.id = "vr-atendimento";
    document.body.appendChild(host);
    var root = host.attachShadow ? host.attachShadow({ mode: "open" }) : host;
    root.innerHTML = '<style>' + CSS + '</style><div class="vr' + (DARK ? ' dark' : '') + '">' +
      '<button class="launcher mono" type="button" aria-haspopup="dialog" aria-expanded="false">' + ICON_CHAT + '<span class="label">' + escapeHtml(LABEL) + '</span><span class="dot" aria-hidden="true"></span></button>' +
      '<section class="panel" role="dialog" aria-modal="false" aria-label="Atendimento" aria-hidden="true">' +
        '<header class="head"><img class="mark" src="' + LOGO + '" alt="" aria-hidden="true"><span class="who"><b>Vinicius Riudi</b><small class="mono"><i aria-hidden="true"></i>Atendimento online</small></span><button class="close" type="button" aria-label="Fechar atendimento">' + ICON_CLOSE + '</button></header>' +
        '<div class="body"></div>' +
        '<form class="composer" hidden><textarea rows="1" maxlength="1000" placeholder="Escreva sua mensagem…" aria-label="Mensagem"></textarea><button class="primary mono" type="submit">Enviar</button></form>' +
        '<div class="foot mono">Atendimento com IA · Vinicius Riudi</div>' +
      '</section></div>';

    var launcher = root.querySelector(".launcher");
    var panel = root.querySelector(".panel");
    var body = root.querySelector(".body");
    var composer = root.querySelector(".composer");
    var input = composer.querySelector("textarea");
    var sendButton = composer.querySelector("button");
    var messages = null, typing = null, busy = false, started = false;

    function open() {
      panel.classList.add("is-open"); panel.setAttribute("aria-hidden", "false");
      launcher.classList.add("is-open"); launcher.setAttribute("aria-expanded", "true");
      setTimeout(function () { var first = started ? input : body.querySelector("input"); if (first) first.focus(); }, 60);
    }
    function close() {
      panel.classList.remove("is-open"); panel.setAttribute("aria-hidden", "true");
      launcher.classList.remove("is-open"); launcher.setAttribute("aria-expanded", "false");
      launcher.focus();
    }
    launcher.addEventListener("click", open);
    root.querySelector(".close").addEventListener("click", close);
    // Esc fecha o painel, onde quer que esteja o foco (dentro do widget ou na página).
    document.addEventListener("keydown", function (event) { if (event.key === "Escape" && panel.classList.contains("is-open")) close(); });

    function showError(container, text) {
      var old = container.querySelector(".error"); if (old) old.remove();
      if (!text) return;
      var p = document.createElement("p"); p.className = "error"; p.setAttribute("role", "alert"); p.textContent = text;
      container.appendChild(p);
    }

    function leadForm() {
      started = false;
      composer.hidden = true;
      body.innerHTML = '<div class="intro"><h2>Olá! Vamos conversar?</h2><p>Para começar o atendimento, me conte quem é você. Assim Vinicius também consegue retornar o seu contato.</p></div>' +
        '<form class="lead" novalidate>' +
          '<label>Nome<input name="nome" autocomplete="name" maxlength="120" required></label>' +
          '<label>Telefone (WhatsApp)<input name="telefone" type="tel" inputmode="tel" autocomplete="tel-national" placeholder="(82) 99999-0000" maxlength="16" required></label>' +
          '<label>E-mail<input name="email" type="email" inputmode="email" autocomplete="email" maxlength="254" required></label>' +
          '<button class="primary mono" type="submit">Começar atendimento</button>' +
          '<p class="legal">Seus dados são usados só para responder ao seu contato.</p>' +
        '</form>';
      var form = body.querySelector("form");
      var phone = form.querySelector('[name="telefone"]');
      phone.addEventListener("input", function () { phone.value = phoneMask(phone.value); });
      form.addEventListener("submit", function (event) {
        event.preventDefault();
        var data = { nome: form.nome.value.trim(), telefone: phone.value, email: form.email.value.trim() };
        Array.prototype.forEach.call(form.querySelectorAll("input"), function (field) { field.removeAttribute("aria-invalid"); });
        var local = data.nome.length < 2 ? ["nome", "Informe seu nome."] : phone.value.replace(/\D/g, "").length < 10 ? ["telefone", "Informe um telefone com DDD."] : !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email) ? ["email", "Informe um e-mail válido."] : null;
        if (local) { form[local[0]].setAttribute("aria-invalid", "true"); form[local[0]].focus(); showError(form, local[1]); return; }
        var button = form.querySelector("button"); button.disabled = true; button.textContent = "Iniciando…";
        data.sessionId = state.sessionId;
        request("POST", "/inicio", data).then(function (result) {
          button.disabled = false; button.textContent = "Começar atendimento";
          if (result.__status !== 200) {
            if (result.field && form[result.field]) { form[result.field].setAttribute("aria-invalid", "true"); form[result.field].focus(); }
            showError(form, result.error || "Não foi possível iniciar agora. Tente de novo em instantes.");
            return;
          }
          state.name = result.nome; save(state);
          chat([], "Prazer, " + result.nome + "! Como posso ajudar? Pode me contar sobre o seu projeto ou tirar dúvidas sobre os serviços.");
        }).catch(function () { button.disabled = false; button.textContent = "Começar atendimento"; showError(form, "Sem conexão. Tente de novo em instantes."); });
      });
    }

    function addMessage(role, text) {
      var item = document.createElement("div");
      item.className = "msg " + (role === "user" ? "user" : "ai");
      if (role === "user") { var bubble = document.createElement("div"); bubble.className = "bubble"; bubble.textContent = text; item.appendChild(bubble); }
      else item.innerHTML = '<span class="avatar" aria-hidden="true"><img src="' + LOGO + '" alt=""></span><div class="text">' + render(text) + '</div>';
      messages.appendChild(item);
      body.scrollTop = body.scrollHeight;
    }
    function setTyping(on) {
      if (on && !typing) { typing = document.createElement("div"); typing.className = "typing mono"; typing.setAttribute("role", "status"); typing.innerHTML = '<span class="avatar" aria-hidden="true"><img src="' + LOGO + '" alt=""></span><span class="dots" aria-hidden="true"><i></i><i></i><i></i></span><span>Digitando</span>'; messages.appendChild(typing); body.scrollTop = body.scrollHeight; }
      if (!on && typing) { typing.remove(); typing = null; }
    }
    function setBusy(on) { busy = on; sendButton.disabled = on; setTyping(on); }

    function chat(history, greeting) {
      started = true;
      body.innerHTML = '<div class="msgs" aria-live="polite"></div>';
      messages = body.querySelector(".msgs");
      if (greeting && !history.length) addMessage("ai", greeting);
      history.forEach(function (message) { addMessage(message.role, message.text); });
      composer.hidden = false;
      input.focus();
    }

    function poll(runId, startedAt) {
      setTimeout(function () {
        request("GET", "?sessionId=" + encodeURIComponent(state.sessionId) + "&run=" + encodeURIComponent(runId)).then(function (result) {
          if (result.status === "DONE" || result.status === "FAILED") { setBusy(false); addMessage("ai", result.reply || "Não consegui responder agora. Tente de novo em instantes."); input.focus(); return; }
          if (Date.now() - startedAt < MAX_POLL_MS) poll(runId, startedAt);
          else { setBusy(false); showError(messages, "A resposta está demorando. Tente de novo em instantes."); }
        }).catch(function () { if (Date.now() - startedAt < MAX_POLL_MS) poll(runId, startedAt); else setBusy(false); });
      }, POLL_MS);
    }

    function send() {
      var text = input.value.trim();
      if (!text || busy) return;
      input.value = ""; input.style.height = "";
      showError(messages, null);
      addMessage("user", text);
      setBusy(true);
      request("POST", "", { sessionId: state.sessionId, message: text }).then(function (result) {
        if (result.__status === 202 && result.runId) { poll(result.runId, Date.now()); return; }
        setBusy(false);
        if (result.code === "dados") { leadForm(); return; }
        showError(messages, result.error || "Não foi possível enviar. Tente de novo.");
      }).catch(function () { setBusy(false); showError(messages, "Sem conexão. Tente de novo em instantes."); });
    }
    composer.addEventListener("submit", function (event) { event.preventDefault(); send(); });
    input.addEventListener("keydown", function (event) { if (event.key === "Enter" && !event.shiftKey && !event.isComposing) { event.preventDefault(); send(); } });
    input.addEventListener("input", function () { input.style.height = "auto"; input.style.height = Math.min(input.scrollHeight, 140) + "px"; });

    // Retoma a conversa deste navegador, se já começou.
    request("GET", "?sessionId=" + encodeURIComponent(state.sessionId)).then(function (session) {
      if (session.started) {
        chat(session.messages || [], null);
        if (session.pendingRun) { setBusy(true); poll(session.pendingRun, Date.now()); }
      } else leadForm();
    }).catch(leadForm);
  }

  function boot() {
    request("GET", "?status=1").then(function (result) { if (result.available) start(); }).catch(function () {});
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
`;
