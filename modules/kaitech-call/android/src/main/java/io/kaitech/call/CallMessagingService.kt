package io.kaitech.call

import android.content.Context
import android.util.Log
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class CallMessagingService : FirebaseMessagingService() {
  private val delegate: Any? by lazy { expoDelegate(this) }

  override fun onMessageReceived(remoteMessage: RemoteMessage) {
    val data = remoteMessage.data
    val type = data["type"]
    if (type == MessagePush.MESSAGE) {
      val push = MessagePush.from(data)
      if (push == null) forward(remoteMessage) else MessageNotifications.show(this, push)
      return
    }
    if (type == MessagePush.READ) {
      MessageKey.from(data)?.let { MessageNotifications.clear(this, it.value) }
      return
    }
    if ((type != CALL && type != CANCEL) || data["model"] != "discuss.channel") {
      forward(remoteMessage)
      return
    }
    val channelId = data["res_id"]?.toIntOrNull() ?: 0
    if (channelId <= 0) {
      forward(remoteMessage)
      return
    }
    val callId = data["call_id"]?.toIntOrNull() ?: 0
    val system = CallBridge.module == null || !CallBridge.foreground || CallBridge.locked
    if (type == CANCEL) {
      if (system) CallService.cancelRing(this, channelId)
      CallBridge.send(mapOf("type" to "cancel", "channelId" to channelId, "callId" to callId))
      return
    }
    val title = data["title"].orEmpty().ifBlank { data["caller"].orEmpty() }
    val body = data["body"].orEmpty()
    val video = data["video"] == "1"
    val db = data["db"].orEmpty()
    val uid = data["uid"]?.toIntOrNull() ?: 0
    if (system) CallService.ring(this, CallService.Ring(title, body, channelId, callId, video, db, uid, system = true))
    CallBridge.send(
      mapOf(
        "type" to "incoming",
        "system" to system,
        "channelId" to channelId,
        "callId" to callId,
        "video" to video,
        "title" to title,
        "body" to body,
        "caller" to data["caller"].orEmpty(),
        "db" to db,
        "uid" to uid,
      ),
    )
  }

  override fun onNewToken(token: String) {
    val handler = delegate ?: return
    try {
      handler.javaClass.getMethod("onNewToken", String::class.java).invoke(handler, token)
    } catch (error: ReflectiveOperationException) {
      Log.w(TAG, "expo could not take the push token", error)
    }
  }

  override fun onDeletedMessages() {
    val handler = delegate ?: return
    try {
      handler.javaClass.getMethod("onDeletedMessages").invoke(handler)
    } catch (error: ReflectiveOperationException) {
      Log.w(TAG, "expo could not take the dropped messages", error)
    }
  }

  private fun forward(message: RemoteMessage) {
    val handler = delegate ?: return
    try {
      handler.javaClass.getMethod("onMessageReceived", RemoteMessage::class.java).invoke(handler, message)
    } catch (error: ReflectiveOperationException) {
      Log.w(TAG, "expo could not take the notification", error)
    }
  }

  private companion object {
    const val TAG = "KaitechCall"
    const val CALL = "CALL"
    const val CANCEL = "CANCEL"

    fun expoDelegate(context: Context): Any? {
      return try {
        val cls = Class.forName("expo.modules.notifications.service.delegates.FirebaseMessagingDelegate")
        cls.getConstructor(Context::class.java).newInstance(context)
      } catch (error: Throwable) {
        Log.w(TAG, "expo notifications delegate missing", error)
        null
      }
    }
  }
}
