/**
 * Probe v5 backend — STOP GUESSING. Enumerate the real API surface.
 *
 * v4 proved: worker runs, spindle.onFrontendMessage registers, requests
 * arrive. What it did NOT prove is how to send a reply BACK, because
 * ctx.sendToBackend is fire-and-forget (it ignored our return value).
 *
 * So instead of guessing another function name, this dumps every key on
 * `spindle` and its sub-objects into the Termux log. One look and we know
 * the entire vocabulary available to us.
 */

console.log('[probe5:backend] ===== API SURFACE DUMP =====')

var api = spindle

function dump(label, obj) {
  if (!obj) {
    console.log('[probe5] ' + label + ' = ' + String(obj))
    return
  }
  var out = []
  for (var k in obj) {
    var t = 'unknown'
    try {
      t = typeof obj[k]
    } catch (e) {
      t = 'threw'
    }
    out.push(k + ':' + t)
  }
  // Own keys too, in case the for-in missed non-enumerables.
  try {
    var own = Object.getOwnPropertyNames(obj)
    console.log('[probe5] ' + label + ' ownProps = ' + own.join(', '))
  } catch (e) {}
  console.log('[probe5] ' + label + ' = ' + out.join(', '))
}

dump('spindle', api)
dump('spindle.chat', api && api.chat)
dump('spindle.chats', api && api.chats)
dump('spindle.frontend', api && api.frontend)
dump('spindle.ui', api && api.ui)
dump('spindle.settings', api && api.settings)
dump('spindle.generate', api && api.generate)
dump('spindle.log', api && api.log)

console.log('[probe5:backend] ===== END DUMP =====')

var activeChatId = null

try {
  api.on('CHAT_SWITCHED', function (payload) {
    activeChatId = payload && payload.chatId ? payload.chatId : null
    console.log('[probe5] CHAT_SWITCHED ->', activeChatId)
  })
} catch (e) {
  console.log('[probe5] CHAT_SWITCHED subscribe failed: ' + String(e))
}

// Some builds expose the active chat through settings; try to read it once.
try {
  if (api.settings && typeof api.settings.get === 'function') {
    Promise.resolve(api.settings.get('activeChatId'))
      .then(function (v) {
        console.log('[probe5] settings.get(activeChatId) =', JSON.stringify(v))
      })
      .catch(function (e) {
        console.log('[probe5] settings.get threw: ' + String(e))
      })
  }
} catch (e) {
  console.log('[probe5] settings probe threw: ' + String(e))
}

/** Try every plausible way to push data to the frontend; report what exists. */
function replyToFrontend(data) {
  var tried = []
  var candidates = [
    ['spindle.sendToFrontend', api && api.sendToFrontend, api],
    ['spindle.emitToFrontend', api && api.emitToFrontend, api],
    ['spindle.frontend.send', api && api.frontend && api.frontend.send, api && api.frontend],
    ['spindle.frontend.emit', api && api.frontend && api.frontend.emit, api && api.frontend],
    ['spindle.ui.send', api && api.ui && api.ui.send, api && api.ui],
    ['spindle.emit', api && api.emit, api],
  ]
  for (var i = 0; i < candidates.length; i++) {
    var name = candidates[i][0]
    var fn = candidates[i][1]
    var thisArg = candidates[i][2]
    if (typeof fn === 'function') {
      try {
        fn.call(thisArg, data)
        console.log('[probe5] replied via ' + name)
        return name
      } catch (e) {
        tried.push(name + ' threw:' + String(e && e.message))
      }
    } else {
      tried.push(name + ' missing')
    }
  }
  console.log('[probe5] NO REPLY CHANNEL. tried: ' + tried.join(' | '))
  return null
}

api.onFrontendMessage(async function (payload) {
  console.log('[probe5] request:', JSON.stringify(payload))

  var chatId = (payload && payload.chatId) || activeChatId
  var result

  if (!chatId) {
    result = { type: 'history', ok: false, error: 'no chatId (frontend sent none, no CHAT_SWITCHED yet)' }
  } else {
    try {
      var msgs = await api.chat.getMessages(chatId)
      console.log('[probe5] getMessages returned ' + ((msgs && msgs.length) || 0) + ' messages')
      var slim = (msgs || []).slice(-12).map(function (m) {
        return { id: m.id, role: m.role, content: String(m.content || '') }
      })
      result = { type: 'history', ok: true, chatId: chatId, count: (msgs || []).length, messages: slim }
    } catch (e) {
      console.log('[probe5] getMessages threw: ' + String(e))
      result = { type: 'history', ok: false, error: String((e && e.message) || e) }
    }
  }

  // Push it back (return value is ignored by the frontend, as v4 proved).
  replyToFrontend(result)

  // Also return it, in case some call path DOES use the return value.
  return result
})

console.log('[probe5:backend] handler ready')
