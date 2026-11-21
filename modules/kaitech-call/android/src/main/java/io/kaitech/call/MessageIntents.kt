package io.kaitech.call

import android.app.Activity
import android.content.Intent

object MessageIntents {
  fun isOpen(intent: Intent?): Boolean = intent?.action == MessageNotifications.ACTION_OPEN && intent.hasExtra(MessageNotifications.EXTRA_KEY)

  fun take(activity: Activity?): Map<String, Any?>? {
    val intent = activity?.intent ?: return null
    if (!isOpen(intent)) return null
    val target = MessageKey.parse(intent.getStringExtra(MessageNotifications.EXTRA_KEY).orEmpty())
    intent.action = Intent.ACTION_MAIN
    intent.removeExtra(MessageNotifications.EXTRA_KEY)
    target ?: return null
    return mapOf("db" to target.db, "uid" to target.uid, "channelId" to target.channelId)
  }
}
