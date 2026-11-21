package io.kaitech.call

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

class CallActionReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val channelId = intent.getIntExtra(CallIntents.EXTRA_CHANNEL_ID, 0)
    when (intent.action) {
      CallNotifications.ACTION_DECLINE -> {
        CallService.cancelRing(context, channelId)
        val payload = mapOf<String, Any?>(
          "type" to "decline",
          "channelId" to channelId,
          "callId" to intent.getIntExtra(CallIntents.EXTRA_CALL_ID, 0),
          "db" to intent.getStringExtra(CallIntents.EXTRA_DB),
          "uid" to intent.getIntExtra(CallIntents.EXTRA_UID, 0),
        )
        if (CallBridge.module == null) {
          CallDeclineTask.enqueue(
            context,
            channelId,
            intent.getIntExtra(CallIntents.EXTRA_CALL_ID, 0),
            intent.getStringExtra(CallIntents.EXTRA_DB) ?: "",
            intent.getIntExtra(CallIntents.EXTRA_UID, 0),
          )
        } else {
          CallBridge.send(payload)
        }
      }
      CallNotifications.ACTION_HANGUP -> CallBridge.send(mapOf("type" to "hangup"))
      CallNotifications.ACTION_STOP_SHARING -> CallBridge.send(mapOf("type" to "stopShare"))
      CallPip.ACTION_TOGGLE_MUTE -> CallBridge.send(mapOf("type" to "mute"))
      CallPip.ACTION_TOGGLE_CAMERA -> CallBridge.send(mapOf("type" to "camera"))
      CallNotifications.ACTION_ANSWER -> {
        Log.i("KaitechCall", "answer from the notification, the app opens for the call")
      }
    }
  }
}
