package io.kaitech.call

import android.content.Context
import android.content.Intent
import expo.modules.kotlin.AppContext

object CallIntents {
  const val ACTION = "io.kaitech.call.INCOMING"
  const val EXTRA_ANSWER = "kaitech.call.answer"
  const val EXTRA_CHANNEL_ID = "kaitech.call.channelId"
  const val EXTRA_CALL_ID = "kaitech.call.callId"
  const val EXTRA_VIDEO = "kaitech.call.video"
  const val EXTRA_TITLE = "kaitech.call.title"
  const val EXTRA_DB = "kaitech.call.db"
  const val EXTRA_UID = "kaitech.call.uid"

  fun fill(intent: Intent, ring: CallService.Ring): Intent = intent.apply {
    putExtra(EXTRA_CHANNEL_ID, ring.channelId)
    putExtra(EXTRA_CALL_ID, ring.callId)
    putExtra(EXTRA_VIDEO, ring.video)
    putExtra(EXTRA_TITLE, ring.title)
    putExtra(EXTRA_DB, ring.db)
    putExtra(EXTRA_UID, ring.uid)
  }

  fun openIntent(context: Context, answer: Boolean, ring: CallService.Ring): Intent {
    val intent = context.packageManager.getLaunchIntentForPackage(context.packageName) ?: Intent()
    intent.action = ACTION
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    fill(intent, ring)
    intent.putExtra(EXTRA_ANSWER, answer)
    return intent
  }

  fun isCall(intent: Intent?): Boolean = intent?.action == ACTION && intent.hasExtra(EXTRA_CHANNEL_ID)

  fun takeLaunch(context: AppContext): Map<String, Any?>? {
    val activity = context.currentActivity ?: return null
    val intent = activity.intent ?: return null
    if (!isCall(intent)) return null
    val answer = intent.getBooleanExtra(EXTRA_ANSWER, false)
    val payload = mapOf<String, Any?>(
      "type" to if (answer) "answer" else "open",
      "channelId" to intent.getIntExtra(EXTRA_CHANNEL_ID, 0),
      "callId" to intent.getIntExtra(EXTRA_CALL_ID, 0),
      "video" to intent.getBooleanExtra(EXTRA_VIDEO, false),
      "title" to intent.getStringExtra(EXTRA_TITLE),
      "db" to intent.getStringExtra(EXTRA_DB),
      "uid" to intent.getIntExtra(EXTRA_UID, 0),
    )
    intent.action = Intent.ACTION_MAIN
    intent.removeExtra(EXTRA_CHANNEL_ID)
    intent.removeExtra(EXTRA_ANSWER)
    CallService.cancelRing(activity, payload["channelId"] as Int)
    return payload
  }
}
