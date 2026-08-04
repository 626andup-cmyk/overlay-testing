/**
 * Overlay Probe v3 — geometry test.
 *
 * v2 proved the extension loads and mountApp() works, but showed the
 * app-overlay paints ON TOP of the native input bar. So a real chat window
 * can't just use `inset: 0` — it has to stop above the input bar.
 *
 * This version:
 *   1. Finds the native input bar (by several strategies, reporting which won)
 *   2. Measures it and fits the overlay to end exactly at its top edge
 *   3. Re-fits on resize, keyboard open/close, and orientation change
 *   4. Prints every number it measured, live, so we can see if it holds up
 *
 * Still pointer-events:none — the app stays fully usable.
 */
export function setup(ctx) {
  console.log('[probe3] setup() called')

  const removeStyle = ctx.dom.addStyle(
    '.probe-badge{position:fixed;bottom:8px;left:8px;max-width:70vw;' +
      'padding:8px 10px;background:rgba(20,20,28,.92);border:2px solid #a855f7;' +
      'border-radius:10px;font-size:11px;line-height:1.4;color:#fff;' +
      'z-index:2147483647;pointer-events:none;white-space:pre-line;' +
      'font-family:ui-monospace,monospace}' +
      '.probe-fit{position:fixed;left:0;right:0;top:0;' +
      'background:rgba(168,85,247,.20);border:3px dashed rgba(168,85,247,.95);' +
      'box-sizing:border-box;pointer-events:none;display:flex;' +
      'align-items:flex-end;justify-content:center}' +
      '.probe-fit span{margin-bottom:6px;padding:6px 12px;border-radius:999px;' +
      'background:rgba(0,0,0,.7);color:#fff;font-size:12px;font-weight:700}'
  )

  ctx.dom.inject('body', '<div class="probe-badge">probe3 starting...</div>')
  const badge = ctx.dom.query('.probe-badge')

  let mount = null
  let fitEl = null
  try {
    mount = ctx.ui.mountApp({ className: 'probe3-mount', position: 'app-overlay' })
    mount.root.innerHTML =
      '<div class="probe-fit"><span>chat area would go here</span></div>'
    fitEl = mount.root.querySelector('.probe-fit')
  } catch (err) {
    if (badge) badge.textContent = 'mountApp FAILED: ' + (err && err.message)
    return function () {
      removeStyle()
      ctx.dom.cleanup()
    }
  }

  /**
   * Find the native chat input bar.
   * We try increasingly loose strategies and report which one worked, so we
   * learn how fragile this is rather than guessing.
   */
  function findInputBar() {
    const vv = window.visualViewport
    const viewportH = vv ? vv.height : window.innerHeight

    // Find the composer field: visible, wide, in the lower half of the screen.
    const fields = document.querySelectorAll(
      'textarea, input[type="text"], [contenteditable="true"]'
    )
    let composer = null
    for (let i = 0; i < fields.length; i++) {
      const r = fields[i].getBoundingClientRect()
      if (r.width > 80 && r.height > 10 && r.top > viewportH * 0.4) {
        composer = fields[i]
        break
      }
    }
    if (!composer) return { el: null, how: 'NOT FOUND', depth: -1 }

    // Walk UP and keep the OUTERMOST ancestor that still looks like the
    // input bar: full width, anchored to the bottom of the visible viewport,
    // and not so tall that we've grabbed the whole page.
    let best = null
    let bestDepth = -1
    let node = composer
    for (let depth = 0; depth < 8 && node.parentElement; depth++) {
      node = node.parentElement
      const r = node.getBoundingClientRect()
      const fullWidth = r.width >= window.innerWidth * 0.9
      const bottomAnchored = r.bottom >= viewportH - 16
      const notTooTall = r.height <= viewportH * 0.4
      if (fullWidth && bottomAnchored && notTooTall) {
        best = node
        bestDepth = depth
      }
    }

    if (best) return { el: best, how: 'walkup(' + bestDepth + ')', depth: bestDepth }
    return { el: composer, how: 'composer only', depth: -1 }
  }

  let lastHow = ''

  function fit() {
    const found = findInputBar()
    lastHow = found.how

    // visualViewport tracks the area NOT covered by the on-screen keyboard.
    const vv = window.visualViewport
    const viewportH = vv ? vv.height : window.innerHeight

    let bottomGap = 0
    let barTop = null
    let barH = null

    if (found.el) {
      const r = found.el.getBoundingClientRect()
      barTop = Math.round(r.top)
      barH = Math.round(r.height)
      // How far up from the bottom of the visible viewport the overlay must stop.
      bottomGap = Math.max(0, Math.round(viewportH - r.top))
    }

    if (fitEl) {
      fitEl.style.bottom = bottomGap + 'px'
      // When the keyboard is open, visualViewport shrinks; keep the top anchored.
      fitEl.style.top = '0px'
    }

    if (badge) {
      badge.textContent =
        'probe3\n' +
        'found: ' + lastHow + '\n' +
        'bar top: ' + barTop + '  barH: ' + barH + '\n' +
        'innerH: ' + window.innerHeight + '  visualH: ' + Math.round(viewportH) + '\n' +
        'overlay bottom: ' + bottomGap + 'px'
    }

    console.log('[probe3] fit', { how: lastHow, barTop: barTop, bottomGap: bottomGap })
  }

  fit()

  // Re-fit on everything that can move the input bar.
  window.addEventListener('resize', fit)
  window.addEventListener('orientationchange', fit)
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', fit)
    window.visualViewport.addEventListener('scroll', fit)
  }
  // The app re-renders; re-measure periodically so we notice if the bar moves
  // or gets replaced without a resize event firing.
  const poll = setInterval(fit, 1000)

  return function () {
    clearInterval(poll)
    window.removeEventListener('resize', fit)
    window.removeEventListener('orientationchange', fit)
    if (window.visualViewport) {
      window.visualViewport.removeEventListener('resize', fit)
      window.visualViewport.removeEventListener('scroll', fit)
    }
    if (mount) mount.destroy()
    removeStyle()
    ctx.dom.cleanup()
  }
}
