import type { SpindleFrontendContext } from 'lumiverse-spindle-types'

/**
 * Overlay Probe — a deliberately tiny diagnostic extension.
 *
 * It answers three questions, in order, and each one is visible on screen:
 *
 *   1. Does a frontend extension load and run at all on this device?
 *      -> proven by the small badge in the bottom-right corner.
 *         (This uses ctx.dom.inject, the same call the official
 *          "Frontend Only" example uses, so it is the safest possible probe.)
 *
 *   2. Does ctx.ui.mountApp() work, i.e. is app_manipulation actually granted?
 *      -> proven by the big translucent panel. The badge also reports it.
 *
 *   3. Does an 'app-overlay' mount stack BELOW the native chat input bar?
 *      -> answered by looking: the panel is see-through, so if the input bar
 *         paints on top of it, we can use a full-viewport overlay directly.
 *         If the panel covers the input bar instead, we'll size the overlay
 *         to the message area by hand in the real extension.
 *
 * Nothing here is interactive and the panel ignores taps (pointer-events:none),
 * so the app stays fully usable while the probe is installed.
 */
export function setup(ctx: SpindleFrontendContext) {
  const status: string[] = []

  const removeStyle = ctx.dom.addStyle(`
    .probe-badge {
      position: fixed;
      bottom: 16px;
      right: 16px;
      max-width: 60vw;
      padding: 8px 12px;
      background: var(--lumiverse-fill-subtle);
      border: 1px solid var(--lumiverse-border);
      border-radius: var(--lumiverse-radius);
      font-size: 11px;
      line-height: 1.45;
      color: var(--lumiverse-text);
      z-index: 2147483647;
      pointer-events: none;
      white-space: pre-line;
    }
    .probe-overlay {
      position: fixed;
      inset: 0;
      background: rgba(168, 85, 247, 0.18);
      border: 3px dashed rgba(168, 85, 247, 0.9);
      box-sizing: border-box;
      pointer-events: none;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .probe-overlay span {
      padding: 8px 14px;
      border-radius: 999px;
      background: rgba(0, 0, 0, 0.55);
      color: #fff;
      font-size: 13px;
      font-weight: 700;
    }
  `)

  // --- Question 1: does the extension run? -------------------------------
  // If this badge never appears, the problem is loading/building, not the UI API.
  ctx.dom.inject('body', '<div class="probe-badge">Probe: frontend loaded ✓</div>')
  status.push('frontend loaded ✓')

  const badge = ctx.dom.query('.probe-badge')
  const render = () => {
    if (badge) badge.textContent = 'Probe:\n' + status.join('\n')
  }

  // --- Questions 2 and 3: does mountApp work, and how does it stack? -----
  let mount: { root: HTMLElement; destroy: () => void } | null = null
  try {
    mount = ctx.ui.mountApp({
      className: 'probe-mount',
      position: 'app-overlay',
    })
    mount.root.innerHTML =
      '<div class="probe-overlay"><span>app-overlay mount ✓</span></div>'
    status.push('mountApp ✓')
    status.push('Can you still see the input bar?')
  } catch (err) {
    // Most likely cause: app_manipulation not granted by the admin toggle.
    status.push('mountApp ✗ — ' + String((err as Error)?.message ?? err))
  }

  render()

  return () => {
    mount?.destroy()
    removeStyle()
    ctx.dom.cleanup()
  }
}
