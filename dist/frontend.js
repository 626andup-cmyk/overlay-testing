// src/frontend.ts
function setup(ctx) {
  const status = [];
  console.log("[overlay-probe] setup() called");
  const removeStyle = ctx.dom.addStyle(
    ".probe-badge{position:fixed;bottom:16px;right:16px;max-width:60vw;padding:8px 12px;background:#a855f7;border:2px solid #fff;border-radius:10px;font-size:12px;line-height:1.45;color:#fff;z-index:2147483647;pointer-events:none;white-space:pre-line}.probe-overlay{position:fixed;inset:0;background:rgba(168,85,247,.18);border:3px dashed rgba(168,85,247,.9);box-sizing:border-box;pointer-events:none;display:flex;align-items:center;justify-content:center}.probe-overlay span{padding:8px 14px;border-radius:999px;background:rgba(0,0,0,.55);color:#fff;font-size:13px;font-weight:700}"
  );
  ctx.dom.inject("body", '<div class="probe-badge">Probe: frontend loaded</div>');
  status.push("frontend loaded OK");
  console.log("[overlay-probe] badge injected");
  const badge = ctx.dom.query(".probe-badge");
  const render = function() {
    if (badge) badge.textContent = "Probe:\n" + status.join("\n");
  };
  let mount = null;
  try {
    mount = ctx.ui.mountApp({ className: "probe-mount", position: "app-overlay" });
    mount.root.innerHTML = '<div class="probe-overlay"><span>app-overlay mount OK</span></div>';
    status.push("mountApp OK");
    status.push("Input bar still visible?");
    console.log("[overlay-probe] mountApp succeeded");
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    status.push("mountApp FAILED: " + msg);
    console.log("[overlay-probe] mountApp failed:", msg);
  }
  render();
  return function() {
    if (mount) mount.destroy();
    removeStyle();
    ctx.dom.cleanup();
  };
}
export {
  setup
};
