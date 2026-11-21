package io.kaitech.call

import java.util.concurrent.CopyOnWriteArraySet

object CallBridge {
  @Volatile
  var module: KaitechCallModule? = null

  @Volatile
  var foreground = false

  @Volatile
  var inCall = false

  @Volatile
  var locked = false

  private val pending = CopyOnWriteArraySet<Map<String, Any?>>()

  fun setInCall(value: Boolean): Boolean {
    inCall = value
    return true
  }

  fun setLocked(value: Boolean): Boolean {
    locked = value
    return true
  }

  fun setPictureInPicture(value: Boolean) {
    if (CallPip.active == value) return
    CallPip.active = value
    module?.dispatch(mapOf("type" to "pip", "active" to value))
  }

  fun send(action: Map<String, Any?>) {
    val holder = module
    if (holder == null) {
      pending.add(action)
      return
    }
    holder.dispatch(action)
  }

  fun takePending(): List<Map<String, Any?>> {
    val out = pending.toList()
    pending.clear()
    return out
  }
}
