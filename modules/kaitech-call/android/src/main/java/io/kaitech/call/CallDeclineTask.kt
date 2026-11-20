package io.kaitech.call

import android.app.Notification
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

class CallDeclineTask : HeadlessJsTaskService() {
  override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig? {
    val channelId = intent?.getIntExtra(CallIntents.EXTRA_CHANNEL_ID, 0) ?: 0
    if (intent == null || channelId <= 0) return null
    val data = Arguments.createMap().apply {
      putInt("channelId", channelId)
      putInt("callId", intent.getIntExtra(CallIntents.EXTRA_CALL_ID, 0))
      putString("db", intent.getStringExtra(CallIntents.EXTRA_DB) ?: "")
      putInt("uid", intent.getIntExtra(CallIntents.EXTRA_UID, 0))
    }
    return HeadlessJsTaskConfig(TASK, data, 20_000, true)
  }

  override fun onCreate() {
    super.onCreate()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(NOTIFICATION_ID, notification(), ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
    } else {
      startForeground(NOTIFICATION_ID, notification())
    }
  }

  private fun notification(): Notification =
    CallNotifications.silent(this, getString(R.string.kaitech_call_ending_title), getString(R.string.kaitech_call_ending_body))

  companion object {
    const val TASK = "KaitechCallDecline"
    private const val NOTIFICATION_ID = 7103

    fun enqueue(context: Context, channelId: Int, callId: Int, db: String, uid: Int) {
      val intent = Intent(context, CallDeclineTask::class.java)
        .putExtra(CallIntents.EXTRA_CHANNEL_ID, channelId)
        .putExtra(CallIntents.EXTRA_CALL_ID, callId)
        .putExtra(CallIntents.EXTRA_DB, db)
        .putExtra(CallIntents.EXTRA_UID, uid)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(intent) else context.startService(intent)
    }
  }
}
