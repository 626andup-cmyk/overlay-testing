// src/frontend.ts
function setup(ctx) {
  console.log("[probe3] setup() called");
  const removeStyle = ctx.dom.addStyle(
    ".probe-badge{position:fixed;bottom:8px;left:8px;max-width:70vw;padding:8px 10px;background:rgba(20,20,28,.92);border:2px solid #a855f7;border-radius:10px;font-size:11px;line-height:1.4;color:#fff;z-index:2147483647;pointer-events:none;white-space:pre-line;font-family:ui-monospace,monospace}.probe-fit{position:fixed;left:0;right:0;top:0;background:rgba(168,85,247,.20);border:3px dashed rgba(168,85,247,.95);box-sizing:border-box;pointer-events:none;display:flex;align-items:flex-end;justify-content:center}.probe-fit span{margin-bottom:6px;padding:6px 12px;border-radius:999px;background:rgba(0,0,0,.7);color:#fff;font-size:12px;font-weight:700}"
  );
  ctx.dom.inject("body", '<div class="probe-badge">probe3 starting...</div>');
  const badge = ctx.dom.query(".probe-badge");
  let mount = null;
  let fitEl = null;
  try {
    mount = ctx.ui.mountApp({ className: "probe3-mount", position: "app-overlay" });
    mount.root.innerHTML = '<div class="probe-fit"><span>chat area would go here</span></div>';
    fitEl = mount.root.querySelector(".probe-fit");
  } catch (err) {
    if (badge) badge.textContent = "mountApp FAILED: " + (err && err.message);
    return function() {
      removeStyle();
      ctx.dom.cleanup();
    };
  }
  function findInputBar() {
    const fields = document.querySelectorAll(
      'textarea, input[type="text"], [contenteditable="true"]'
    );
    let composer = null;
    for (let i = 0; i < fields.length; i++) {
      const r = fields[i].getBoundingClientRect();
      if (r.width > 80 && r.height > 10 && r.top > window.innerHeight * 0.5) {
        composer = fields[i];
        break;
      }
    }
    if (composer) {
      let node = composer;
      for (let depth = 0; depth < 6 && node.parentElement; depth++) {
        const pr = node.parentElement.getBoundingClientRect();
        if (pr.width >= window.innerWidth * 0.9 && pr.height < window.innerHeight * 0.5) {
          return { el: node.parentElement, how: "composer+walkup(" + depth + ")" };
        }
        node = node.parentElement;
      }
      return { el: composer, how: "composer(no container found)" };
    }
    return { el: null, how: "NOT FOUND" };
  }
  let lastHow = "";
  function fit() {
    const found = findInputBar();
    lastHow = found.how;
    const vv = window.visualViewport;
    const viewportH = vv ? vv.height : window.innerHeight;
    let bottomGap = 0;
    let barTop = null;
    let barH = null;
    if (found.el) {
      const r = found.el.getBoundingClientRect();
      barTop = Math.round(r.top);
      barH = Math.round(r.height);
      bottomGap = Math.max(0, Math.round(viewportH - r.top));
    }
    if (fitEl) {
      fitEl.style.bottom = bottomGap + "px";
      fitEl.style.top = "0px";
    }
    if (badge) {
      badge.textContent = "probe3\nfound: " + lastHow + "\nbar top: " + barTop + "  h: " + barH + "\ninnerH: " + window.innerHeight + "  visualH: " + Math.round(viewportH) + "\noverlay bottom: " + bottomGap + "px";
    }
    console.log("[probe3] fit", { how: lastHow, barTop, bottomGap });
  }
  fit();
  window.addEventListener("resize", fit);
  window.addEventListener("orientationchange", fit);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", fit);
    window.visualViewport.addEventListener("scroll", fit);
  }
  const poll = setInterval(fit, 1e3);
  return function() {
    clearInterval(poll);
    window.removeEventListener("resize", fit);
    window.removeEventListener("orientationchange", fit);
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
