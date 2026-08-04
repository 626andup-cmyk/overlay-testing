/**
 * Probe v4 backend — proves three things:
 *   1. The backend worker actually starts (has_backend: true)
 *   2. spindle.chat.getMessages() returns the real transcript
 *   3. The frontend can ask for it and get an answer back
 *
 * Written defensively: the exact names for frontend<->backend messaging are
 * the last thing not yet confirmed on this device, so we feature-detect and
 * report which one worked instead of assuming and failing silently.
 */

console.log('[probe4:backend] module loaded')

var api = spindle

var activeChatId = null

// Track which chat is open. CHAT_SWITCHED is confirmed: { chatId: string|null }
try {
  api.on('CHAT_SWITCHED', function (payload) {
    activeChatId = payload && payload.chatId ? payload.chatId : null
    console.log('[probe4:backend] CHAT_SWITCHED ->', activeChatId)
  })
  console.log('[probe4:backend] subscribed to CHAT_SWITCHED')
} catch (e) {
  console.log('[probe4:backend] CHAT_SWITCHED subscribe failed:', String(e))
}

async function handleRequest(payload) {
  console.log('[probe4:backend] request:', JSON.stringify(payload))

  var chatId = (payload && payload.chatId) || activeChatId
  if (!chatId) {
    return { ok: false, error: 'no active chat id known yet', how: 'chatId missing' }
  }

  try {
    var msgs = await api.chat.getMessages(chatId)
    var slim = (msgs || []).slice(-12).map(function (m) {
      return { id: m.id, role: m.role, content: String(m.content || '') }
    })
    return { ok: true, chatId: chatId, count: (msgs || []).length, messages: slim }
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e), how: 'getMessages threw' }
  }
}

// Feature-detect the frontend message hook.
var registered = null
try {
  if (typeof api.onFrontendMessage === 'function') {
    api.onFrontendMessage(handleRequest)
    registered = 'spindle.onFrontendMessage'
  } else if (api.frontend && typeof api.frontend.onMessage === 'function') {
    api.frontend.onMessage(handleRequest)
    registered = 'spindle.frontend.onMessage'
  }
} catch (e) {
  console.log('[probe4:backend] handler registration threw:', String(e))
}

console.log('[probe4:backend] frontend handler registered via:', registered)
