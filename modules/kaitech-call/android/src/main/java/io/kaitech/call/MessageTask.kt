package io.kaitech.call

import android.app.Notification
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

class MessageTask : HeadlessJsTaskService() {
  override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig? {
    val extras = intent?.extras ?: return null
    val data = Arguments.createMap().apply {
      putString("kind", extras.getString(EXTRA_KIND, ""))
      putString("db", extras.getString(EXTRA_DB, ""))
      putInt("uid", extras.getInt(EXTRA_UID, 0))
      putInt("channelId", extras.getInt(EXTRA_CHANNEL, 0))
      putString("text", extras.getString(EXTRA_TEXT, ""))
      putString("sendKey", extras.getString(EXTRA_SEND_KEY, ""))
      putInt("messageId", extras.getInt(EXTRA_MESSAGE, 0))
    }
    return HeadlessJsTaskConfig(TASK, data, 45_000, true)
  }

  override fun onCreate() {
    super.onCreate()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(NOTIFICATION_ID, notification(), ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
    } else {
      startForeground(NOTIFICATION_ID, notification())
    }
  }

  private fun notification(): Notification {
    val text = MessageNotifications.localized(this)
    return CallNotifications.silent(this, text.getString(R.string.kaitech_message_sending_title), text.getString(R.string.kaitech_message_sending_body))
  }

  companion object {
    private const val TASK = "KaitechMessageAction"
    private const val NOTIFICATION_ID = 7202
    private const val EXTRA_KIND = "kind"
    private const val EXTRA_DB = "db"
    private const val EXTRA_UID = "uid"
    private const val EXTRA_CHANNEL = "channelId"
    private const val EXTRA_TEXT = "text"
    private const val EXTRA_SEND_KEY = "sendKey"
    private const val EXTRA_MESSAGE = "messageId"

    fun reply(context: Context, target: MessageKey, text: String, sendKey: String) {
      start(context, Intent(context, MessageTask::class.java).putExtra(EXTRA_KIND, "reply").putExtra(EXTRA_TEXT, text).putExtra(EXTRA_SEND_KEY, sendKey), target)
    }

    fun read(context: Context, target: MessageKey, messageId: Int) {
      start(context, Intent(context, MessageTask::class.java).putExtra(EXTRA_KIND, "read").putExtra(EXTRA_MESSAGE, messageId), target)
    }

    private fun start(context: Context, intent: Intent, target: MessageKey) {
      intent.putExtra(EXTRA_DB, target.db).putExtra(EXTRA_UID, target.uid).putExtra(EXTRA_CHANNEL, target.channelId)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(intent) else context.startService(intent)
    }
  }
}
