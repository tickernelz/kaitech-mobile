package io.kaitech.call

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.app.RemoteInput
import java.util.UUID

class MessageActionReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val key = intent.getStringExtra(MessageNotifications.EXTRA_KEY) ?: return
    val target = MessageKey.parse(key) ?: return
    when (intent.action) {
      MessageNotifications.ACTION_REPLY -> {
        val text = RemoteInput.getResultsFromIntent(intent)?.getCharSequence(MessageNotifications.REPLY_KEY)?.toString()?.trim().orEmpty()
        if (text.isEmpty()) {
          MessageNotifications.refresh(context, key, onlyIfShown = false)
          return
        }
        val sendKey = UUID.randomUUID().toString()
        val line = MessageStore.Line(0, "", 0, false, text, System.currentTimeMillis(), mine = true, sendKey = sendKey)
        MessageStore.append(context, key, "", "", line)
        MessageNotifications.refresh(context, key, onlyIfShown = false)
        MessageTask.reply(context, target, text, sendKey)
      }
      MessageNotifications.ACTION_RETRY -> {
        val sendKey = intent.getStringExtra(MessageNotifications.EXTRA_SEND_KEY).orEmpty()
        val line = MessageStore.thread(context, key)?.lines?.lastOrNull { it.mine && it.sendKey == sendKey } ?: return
        MessageStore.settle(context, key, sendKey, failed = false)
        MessageNotifications.refresh(context, key, onlyIfShown = false)
        MessageTask.reply(context, target, line.text, sendKey)
      }
      MessageNotifications.ACTION_READ -> {
        val last = MessageStore.thread(context, key)?.lastMessageId ?: 0
        MessageNotifications.clear(context, key)
        if (last > 0) MessageTask.read(context, target, last)
      }
      MessageNotifications.ACTION_DISMISS -> MessageNotifications.clear(context, key)
    }
  }
}
