/**
 * Probe v4 frontend — mirrors the real conversation into the overlay.
 *
 * Keeps the confirmed-working geometry from v3 (fit above the native input
 * bar, re-fit on keyboard/resize), and adds: ask the backend for the real
 * messages, render them, and report exactly what happened in the badge.
 *
 * The message list IS scrollable (pointer-events:auto) so we also learn
 * whether interaction inside the overlay works. The rest stays click-through.
 */
export function setup(ctx) {
  console.log('[probe4] setup() called')

  var removeStyle = ctx.dom.addStyle(
    '.p4-badge{position:fixed;bottom:6px;left:6px;max-width:72vw;padding:6px 9px;' +
      'background:rgba(20,20,28,.94);border:2px solid #a855f7;border-radius:9px;' +
      'font-size:10px;line-height:1.35;color:#fff;z-index:2147483647;' +
      'pointer-events:none;white-space:pre-line;font-family:ui-monospace,monospace}' +
      '.p4-fit{position:fixed;left:0;right:0;top:0;box-sizing:border-box;' +
      'pointer-events:none;display:flex;flex-direction:column;' +
      'background:rgba(12,10,20,.97)}' +
      '.p4-head{flex:0 0 auto;padding:6px 10px;font-size:11px;color:#c4b5fd;' +
      'border-bottom:1px solid rgba(168,85,247,.35);font-family:ui-monospace,monospace}' +
      '.p4-list{flex:1 1 auto;overflow-y:auto;padding:8px 10px 40px;' +
      'pointer-events:auto;-webkit-overflow-scrolling:touch}' +
      '.p4-msg{margin:0 0 10px;padding:8px 11px;border-radius:14px;' +
      'font-size:14px;line-height:1.45;max-width:82%;word-wrap:break-word;' +
      'white-space:pre-wrap}' +
      '.p4-msg.user{margin-left:auto;background:#3b2f63;color:#fff;' +
      'border-bottom-right-radius:4px}' +
      '.p4-msg.assistant{margin-right:auto;background:#1e1b2e;color:#e9e4ff;' +
      'border-bottom-left-radius:4px}' +
      '.p4-name{font-size:10px;opacity:.65;margin:0 4px 3px}'
  )

  ctx.dom.inject('body', '<div class="p4-badge">probe4 starting...</div>')
  var badge = ctx.dom.query('.p4-badge')

  var mount = null
  var fitEl = null
  var listEl = null
  var headEl = null
  try {
    mount = ctx.ui.mountApp({ className: 'p4-mount', position: 'app-overlay' })
    mount.root.innerHTML =
      '<div class="p4-fit">' +
      '<div class="p4-head">probe4 — mirrored transcript</div>' +
      '<div class="p4-list"></div>' +
      '</div>'
    fitEl = mount.root.querySelector('.p4-fit')
    listEl = mount.root.querySelector('.p4-list')
    headEl = mount.root.querySelector('.p4-head')
  } catch (err) {
    if (badge) badge.textContent = 'mountApp FAILED: ' + (err && err.message)
    return function () {
      removeStyle()
      ctx.dom.cleanup()
    }
  }

  // ---- geometry (confirmed working in v3) --------------------------------
  function findInputBar() {
    var vv = window.visualViewport
    var viewportH = vv ? vv.height : window.innerHeight
    var fields = document.querySelectorAll(
      'textarea, input[type="text"], [contenteditable="true"]'
    )
    var composer = null
    for (var i = 0; i < fields.length; i++) {
      var r = fields[i].getBoundingClientRect()
      if (r.width > 80 && r.height > 10 && r.top > viewportH * 0.4) {
        composer = fields[i]
        break
      }
    }
    if (!composer) return { el: null, how: 'NOT FOUND' }

    var best = null
    var bestDepth = -1
    var node = composer
    for (var depth = 0; depth < 8 && node.parentElement; depth++) {
      node = node.parentElement
      var pr = node.getBoundingClientRect()
      if (
        pr.width >= window.innerWidth * 0.9 &&
        pr.bottom >= viewportH - 16 &&
        pr.height <= viewportH * 0.4
      ) {
        best = node
        bestDepth = depth
      }
    }
    if (best) return { el: best, how: 'walkup(' + bestDepth + ')' }
    return { el: composer, how: 'composer only' }
  }

  var geoLine = ''

  function fit() {
    var found = findInputBar()
    var vv = window.visualViewport
    var viewportH = vv ? vv.height : window.innerHeight
    var gap = 0
    if (found.el) {
      var r = found.el.getBoundingClientRect()
      gap = Math.max(0, Math.round(viewportH - r.top))
    }
    if (fitEl) {
      fitEl.style.bottom = gap + 'px'
      fitEl.style.top = '0px'
    }
    geoLine = 'geo: ' + found.how + ' gap:' + gap
  }

  fit()
  window.addEventListener('resize', fit)
  window.addEventListener('orientationchange', fit)
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', fit)
    window.visualViewport.addEventListener('scroll', fit)
  }
  var poll = setInterval(fit, 1000)

  // ---- talk to the backend ------------------------------------------------
  var sendHow = 'none'
  var lastResult = 'not requested yet'

  function escapeHtml(s) {
    var d = document.createElement('div')
    d.textContent = s
    return d.innerHTML
  }

  function renderMessages(msgs) {
    if (!listEl) return
    var html = ''
    for (var i = 0; i < msgs.length; i++) {
      var m = msgs[i]
      var cls = m.role === 'user' ? 'user' : 'assistant'
      html +=
        '<div class="p4-name" style="text-align:' +
        (cls === 'user' ? 'right' : 'left') +
        '">' +
        escapeHtml(m.role) +
        '</div><div class="p4-msg ' +
        cls +
        '">' +
        escapeHtml(m.content) +
        '</div>'
    }
    listEl.innerHTML = html
    listEl.scrollTop = listEl.scrollHeight
  }

  function renderBadge() {
    if (!badge) return
    badge.textContent =
      'probe4\n' + geoLine + '\nsend: ' + sendHow + '\n' + lastResult
  }

  async function requestHistory() {
    var payload = { type: 'get_history' }
    try {
      var res = null
      if (typeof ctx.sendToBackend === 'function') {
        sendHow = 'ctx.sendToBackend'
        res = await ctx.sendToBackend(payload)
      } else if (ctx.backend && typeof ctx.backend.send === 'function') {
        sendHow = 'ctx.backend.send'
        res = await ctx.backend.send(payload)
      } else {
        sendHow = 'NO SEND FN FOUND'
        lastResult = 'frontend has no backend-send function'
        renderBadge()
        return
      }

      console.log('[probe4] backend replied:', res)

      if (!res) {
        lastResult = 'reply was empty/undefined'
      } else if (res.ok) {
        lastResult = 'OK ' + res.count + ' msgs (showing ' + res.messages.length + ')'
        renderMessages(res.messages)
        if (headEl) headEl.textContent = 'probe4 — ' + res.count + ' messages in chat'
      } else {
        lastResult = 'backend error: ' + res.error + ' [' + res.how + ']'
      }
    } catch (e) {
      lastResult = 'send threw: ' + String((e && e.message) || e)
    }
    renderBadge()
  }

  renderBadge()
  // Give the app a moment to settle on a chat before asking.
  setTimeout(requestHistory, 1200)
  // Re-ask periodically so we can watch it pick up new messages.
  var refresh = setInterval(requestHistory, 6000)

  return function () {
    clearInterval(poll)
    clearInterval(refresh)
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
