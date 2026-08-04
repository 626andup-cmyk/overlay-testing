// src/frontend.ts
function setup(ctx) {
  console.log("[probe5] setup() called");
  var removeStyle = ctx.dom.addStyle(
    ".p5-badge{position:fixed;bottom:6px;left:6px;right:6px;max-height:38vh;overflow-y:auto;padding:7px 9px;background:rgba(10,8,18,.97);border:2px solid #a855f7;border-radius:9px;font-size:9.5px;line-height:1.35;color:#fff;z-index:2147483647;pointer-events:auto;white-space:pre-wrap;font-family:ui-monospace,monospace;word-break:break-all}.p5-fit{position:fixed;left:0;right:0;top:0;box-sizing:border-box;pointer-events:none;display:flex;flex-direction:column;background:rgba(12,10,20,.97)}.p5-head{flex:0 0 auto;padding:5px 10px;font-size:11px;color:#c4b5fd;border-bottom:1px solid rgba(168,85,247,.35);font-family:ui-monospace,monospace}.p5-list{flex:1 1 auto;overflow-y:auto;padding:8px 10px 42vh;pointer-events:auto;-webkit-overflow-scrolling:touch}.p5-msg{margin:0 0 9px;padding:8px 11px;border-radius:14px;font-size:14px;line-height:1.45;max-width:82%;word-wrap:break-word;white-space:pre-wrap}.p5-msg.user{margin-left:auto;background:#3b2f63;color:#fff}.p5-msg.assistant{margin-right:auto;background:#1e1b2e;color:#e9e4ff}"
  );
  ctx.dom.inject("body", '<div class="p5-badge">probe5 starting...</div>');
  var badge = ctx.dom.query(".p5-badge");
  var mount = null;
  var fitEl = null;
  var listEl = null;
  var headEl = null;
  try {
    mount = ctx.ui.mountApp({ className: "p5-mount", position: "app-overlay" });
    mount.root.innerHTML = '<div class="p5-fit"><div class="p5-head">probe5</div><div class="p5-list"></div></div>';
    fitEl = mount.root.querySelector(".p5-fit");
    listEl = mount.root.querySelector(".p5-list");
    headEl = mount.root.querySelector(".p5-head");
  } catch (err) {
    if (badge) badge.textContent = "mountApp FAILED: " + (err && err.message);
    return function() {
      removeStyle();
      ctx.dom.cleanup();
    };
  }
  function keysOf(o) {
    if (!o) return String(o);
    var out = [];
    for (var k in o) {
      var t;
      try {
        t = typeof o[k];
      } catch (e) {
        t = "?";
      }
      out.push(k + ":" + t.charAt(0));
    }
    return out.join(" ");
  }
  var ctxKeys = keysOf(ctx);
  console.log("[probe5] ctx keys:", ctxKeys);
  console.log("[probe5] ctx.chat:", keysOf(ctx.chat));
  console.log("[probe5] ctx.events:", keysOf(ctx.events));
  console.log("[probe5] url:", location.href);
  function chatIdFromUrl() {
    var m = location.href.match(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
    );
    return m ? m[0] : null;
  }
  function findInputBar() {
    var vv = window.visualViewport;
    var vh = vv ? vv.height : window.innerHeight;
    var fields = document.querySelectorAll(
      'textarea, input[type="text"], [contenteditable="true"]'
    );
    var composer = null;
    for (var i2 = 0; i2 < fields.length; i2++) {
      var r = fields[i2].getBoundingClientRect();
      if (r.width > 80 && r.height > 10 && r.top > vh * 0.4) {
        composer = fields[i2];
        break;
      }
    }
    if (!composer) return { el: null, how: "NOT FOUND" };
    var best = null;
    var bd = -1;
    var node = composer;
    for (var d = 0; d < 8 && node.parentElement; d++) {
      node = node.parentElement;
      var pr = node.getBoundingClientRect();
      if (pr.width >= window.innerWidth * 0.9 && pr.bottom >= vh - 16 && pr.height <= vh * 0.4) {
        best = node;
        bd = d;
      }
    }
    return best ? { el: best, how: "walkup(" + bd + ")" } : { el: composer, how: "composer" };
  }
  var geoLine = "";
  function fit() {
    var f = findInputBar();
    var vv = window.visualViewport;
    var vh = vv ? vv.height : window.innerHeight;
    var gap = 0;
    if (f.el) gap = Math.max(0, Math.round(vh - f.el.getBoundingClientRect().top));
    if (fitEl) {
      fitEl.style.bottom = gap + "px";
      fitEl.style.top = "0px";
    }
    geoLine = "geo " + f.how + " gap:" + gap;
  }
  fit();
  window.addEventListener("resize", fit);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", fit);
    window.visualViewport.addEventListener("scroll", fit);
  }
  var poll = setInterval(fit, 1e3);
  var inboundHow = [];
  var lastReply = "none yet";
  function escapeHtml(s) {
    var d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }
  function handleReply(data) {
    console.log("[probe5] REPLY RECEIVED:", data);
    if (!data) {
      lastReply = "reply: empty";
    } else if (data.ok) {
      lastReply = "reply OK " + data.count + " msgs";
      var html = "";
      for (var i2 = 0; i2 < data.messages.length; i2++) {
        var m = data.messages[i2];
        html += '<div class="p5-msg ' + (m.role === "user" ? "user" : "assistant") + '">' + escapeHtml(m.content) + "</div>";
      }
      if (listEl) {
        listEl.innerHTML = html;
        listEl.scrollTop = listEl.scrollHeight;
      }
      if (headEl) headEl.textContent = "probe5 \u2014 " + data.count + " messages";
    } else {
      lastReply = "reply ERR: " + data.error;
    }
    render();
  }
  var inboundCandidates = [
    ["ctx.onBackendMessage", ctx.onBackendMessage, ctx],
    ["ctx.backend.onMessage", ctx.backend && ctx.backend.onMessage, ctx.backend],
    ["ctx.onMessage", ctx.onMessage, ctx]
  ];
  for (var i = 0; i < inboundCandidates.length; i++) {
    var nm = inboundCandidates[i][0];
    var fn = inboundCandidates[i][1];
    var ta = inboundCandidates[i][2];
    if (typeof fn === "function") {
      try {
        fn.call(ta, handleReply);
        inboundHow.push(nm + " OK");
      } catch (e) {
        inboundHow.push(nm + " threw");
      }
    } else {
      inboundHow.push(nm + " missing");
    }
  }
  console.log("[probe5] inbound channels:", inboundHow.join(" | "));
  function render() {
    if (!badge) return;
    badge.textContent = "probe5\n" + geoLine + "\nURL: " + location.href.slice(-70) + "\nchatId guess: " + chatIdFromUrl() + "\ninbound: " + inboundHow.join(" | ") + "\n" + lastReply + "\n--- ctx keys ---\n" + ctxKeys + "\n--- ctx.chat ---\n" + keysOf(ctx.chat);
  }
  function ask() {
    var id = chatIdFromUrl();
    try {
      ctx.sendToBackend({ type: "get_history", chatId: id });
    } catch (e) {
      lastReply = "send threw: " + String(e && e.message);
    }
    render();
  }
  render();
  setTimeout(ask, 1500);
  var refresh = setInterval(ask, 8e3);
  return function() {
    clearInterval(poll);
    clearInterval(refresh);
    window.removeEventListener("resize", fit);
    if (window.visualViewport) {
      window.visualViewport.removeEventListener("resize", fit);
      window.visualViewport.removeEventListener("scroll", fit);
    }
    if (mount) mount.destroy();
    removeStyle();
    ctx.dom.cleanup();
  };
}
export {
  setup
};
