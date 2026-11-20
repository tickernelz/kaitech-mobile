package io.kaitech.call

import android.content.Context
import android.content.Intent
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

class CallDeclineTask : HeadlessJsTaskService() {
  override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig? {
    val channelId = intent?.getIntExtra(CallIntents.EXTRA_CHANNEL_ID, 0) ?: 0
    if (channelId <= 0 || intent == null) return null
    val data = Arguments.createMap().apply {
      putInt("channelId", channelId)
      putInt("callId", intent.getIntExtra(CallIntents.EXTRA_CALL_ID, 0))
      putString("db", intent.getStringExtra(CallIntents.EXTRA_DB) ?: "")
      putInt("uid", intent.getIntExtra(CallIntents.EXTRA_UID, 0))
    }
    return HeadlessJsTaskConfig(TASK, data, 20_000, true)
  }

  companion object {
    const val TASK = "KaitechCallDecline"

    fun enqueue(context: Context, channelId: Int) {
      val intent = Intent(context, CallDeclineTask::class.java).putExtra(CallIntents.EXTRA_CHANNEL_ID, channelId)
      context.startService(intent)
    }
  }
}
