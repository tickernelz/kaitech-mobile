package io.kaitech.call

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.app.NotificationCompat
import androidx.core.app.Person
import androidx.core.app.RemoteInput
import androidx.core.content.LocusIdCompat
import androidx.core.content.pm.ShortcutInfoCompat
import androidx.core.content.pm.ShortcutManagerCompat
import androidx.core.graphics.drawable.IconCompat
import java.util.Locale

object MessageNotifications {
  const val MESSAGES = "messages"
  const val MENTIONS = "kaitech_mentions"
  const val MUTED = "kaitech_messages_muted"
  const val REPLY_KEY = "io.kaitech.message.reply"
  const val ACTION_REPLY = "io.kaitech.message.REPLY"
  const val ACTION_READ = "io.kaitech.message.READ"
  const val ACTION_RETRY = "io.kaitech.message.RETRY"
  const val ACTION_DISMISS = "io.kaitech.message.DISMISS"
  const val ACTION_OPEN = "io.kaitech.message.OPEN"
  const val EXTRA_KEY = "io.kaitech.message.key"
  const val EXTRA_SEND_KEY = "io.kaitech.message.sendKey"
  private const val GROUP = "io.kaitech.messages"
  private const val SUMMARY = "io.kaitech.messages.summary"
  private const val ID = 7201
  private const val AVATAR = 128
  private const val ACTION_SCHEME = "kaitech-message"
  private const val CALL = "call"
  private const val MISSED_CALL = "call_missed"
  private val palette = intArrayOf(
    0xFF441D65.toInt(),
    0xFF1F6F8B.toInt(),
    0xFF2E7D32.toInt(),
    0xFFAD5A00.toInt(),
    0xFF8E2453.toInt(),
    0xFF3949AB.toInt(),
    0xFF00796B.toInt(),
    0xFF6D4C41.toInt(),
  )

  fun localized(context: Context): Context {
    val language = MessageStore.language(context) ?: return context
    val config = Configuration(context.resources.configuration)
    config.setLocale(Locale.forLanguageTag(language))
    return context.createConfigurationContext(config)
  }

  fun ensureChannels(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = context.getSystemService(NotificationManager::class.java) ?: return
    val messages = NotificationChannel(MESSAGES, context.getString(R.string.kaitech_message_channel), NotificationManager.IMPORTANCE_HIGH).apply {
      description = context.getString(R.string.kaitech_message_channel_description)
    }
    val mentions = NotificationChannel(MENTIONS, context.getString(R.string.kaitech_mention_channel), NotificationManager.IMPORTANCE_HIGH).apply {
      description = context.getString(R.string.kaitech_mention_channel_description)
    }
    val muted = NotificationChannel(MUTED, context.getString(R.string.kaitech_muted_channel), NotificationManager.IMPORTANCE_LOW).apply {
      description = context.getString(R.string.kaitech_muted_channel_description)
      setSound(null, null)
      enableVibration(false)
    }
    manager.createNotificationChannels(listOf(messages, mentions, muted))
  }

  private val calls = java.util.concurrent.ConcurrentHashMap<String, MessagePush>()

  fun rememberCall(data: Map<String, String>) {
    val target = MessageKey.from(data) ?: return
    val caller = data["caller"].orEmpty()
    calls[target.value] = MessagePush(
      db = target.db,
      uid = target.uid,
      channelId = target.channelId,
      channelType = data["channel_type"].orEmpty().ifBlank { "chat" },
      channelName = data["channel_name"].orEmpty().ifBlank { data["title"].orEmpty().ifBlank { caller } },
      senderId = data["caller_partner_id"]?.toIntOrNull() ?: 0,
      senderName = caller,
      agent = false,
      messageId = 0,
      ts = System.currentTimeMillis(),
      kind = MISSED_CALL,
      duration = 0,
      fileName = "",
      body = "",
      mention = false,
      muted = false,
    )
  }

  fun missed(context: Context, key: String) {
    val call = calls.remove(key) ?: return
    show(context, call.copy(ts = System.currentTimeMillis()))
  }

  fun forgetCall(key: String) {
    calls.remove(key)
  }

  fun setHidden(context: Context, hidden: Boolean) {
    if (MessageStore.hidden(context) == hidden) return
    MessageStore.setHidden(context, hidden)
    MessageStore.keys(context).forEach { refresh(context, it, onlyIfShown = true) }
    summary(context)
  }

  fun show(context: Context, push: MessagePush) {
    if (push.kind == CALL) return
    if (CallBridge.foreground && push.key in MessageStore.openKeys) return
    val text = localized(context)
    val line = MessageStore.Line(push.messageId, sender(text, push), push.senderId, push.agent, describe(text, push), push.ts)
    val thread = MessageStore.append(context, push.key, push.channelName, push.channelType, line) ?: return
    val muted = push.muted || MessageStore.mutedUntil(context, push.key) > System.currentTimeMillis()
    val channel = when {
      push.mention -> MENTIONS
      muted -> MUTED
      else -> MESSAGES
    }
    post(context, push.key, thread, channel, alert = true)
  }

  fun refresh(context: Context, key: String, onlyIfShown: Boolean) {
    val thread = MessageStore.thread(context, key) ?: return
    if (onlyIfShown && !shown(context, key)) return
    post(context, key, thread, MESSAGES, alert = false)
  }

  private fun shown(context: Context, key: String): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return true
    val manager = context.getSystemService(NotificationManager::class.java) ?: return false
    return manager.activeNotifications.any { it.tag == key && it.id == ID }
  }

  fun clear(context: Context, key: String) {
    MessageStore.clear(context, key)
    context.getSystemService(NotificationManager::class.java)?.cancel(key, ID)
    summary(context)
  }

  fun clearAccount(context: Context, account: String) {
    MessageStore.keys(context).filter { it.startsWith("$account:") }.forEach { clear(context, it) }
    MessageStore.clearAccount(context, account)
  }

  fun describe(context: Context, push: MessagePush): String {
    val body = push.body.trim()
    val base = when (push.kind) {
      "image" -> captioned(context.getString(R.string.kaitech_message_photo), body)
      "video" -> captioned(context.getString(R.string.kaitech_message_video), body)
      "voice" -> if (push.duration > 0) context.getString(R.string.kaitech_message_voice_length, clock(push.duration)) else context.getString(R.string.kaitech_message_voice)
      "file" -> if (push.fileName.isNotBlank()) context.getString(R.string.kaitech_message_file_named, push.fileName) else context.getString(R.string.kaitech_message_file)
      MISSED_CALL -> context.getString(R.string.kaitech_message_missed_call)
      "poll" -> captioned(context.getString(R.string.kaitech_message_poll), detailOf(body))
      "location" -> captioned(context.getString(R.string.kaitech_message_location), detailOf(body))
      "live_location" -> context.getString(R.string.kaitech_message_live_location)
      "sticker" -> context.getString(R.string.kaitech_message_sticker)
      "gif" -> context.getString(R.string.kaitech_message_gif)
      else -> body.ifBlank { context.getString(R.string.kaitech_message_new) }
    }
    return if (push.mention) context.getString(R.string.kaitech_message_mention, base) else base
  }

  private fun sender(context: Context, push: MessagePush): String {
    val name = push.senderName.ifBlank { push.channelName }
    if (!push.agent || name.contains("Coworker", ignoreCase = true)) return name
    return context.getString(R.string.kaitech_message_agent, name)
  }

  private fun captioned(label: String, caption: String) = if (caption.isBlank()) label else "$label: $caption"

  private fun detailOf(preview: String) = if (preview.contains(": ")) preview.substringAfter(": ").trim() else ""

  private fun clock(seconds: Int) = "%d:%02d".format(seconds / 60, seconds % 60)

  fun shortcutId(key: String) = "conversation:$key"

  private fun post(context: Context, key: String, thread: MessageStore.Thread, channel: String, alert: Boolean) {
    val target = MessageKey.parse(key) ?: return
    val text = localized(context)
    ensureChannels(text)
    val manager = context.getSystemService(NotificationManager::class.java) ?: return
    val unread = thread.lines.count { !it.mine }
    val builder = NotificationCompat.Builder(context, channel)
      .setSmallIcon(context.applicationInfo.icon)
      .setCategory(NotificationCompat.CATEGORY_MESSAGE)
      .setGroup(GROUP)
      .setAutoCancel(true)
      .setOnlyAlertOnce(!alert)
      .setShowWhen(true)
      .setWhen(thread.lines.lastOrNull()?.ts ?: System.currentTimeMillis())
      .setNumber(unread)
      .setDeleteIntent(broadcast(context, ACTION_DISMISS, key, 3))
      .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
      .setPublicVersion(neutral(text, channel, unread))
    if (MessageStore.hidden(context)) {
      builder
        .setContentTitle(text.getString(R.string.kaitech_message_hidden_title))
        .setContentText(text.resources.getQuantityString(R.plurals.kaitech_message_count, unread.coerceAtLeast(1), unread.coerceAtLeast(1)))
        .setContentIntent(open(context, target))
    } else {
      val failed = thread.failedLine
      val shortcut = shortcut(context, text, target, thread)
      ShortcutManagerCompat.pushDynamicShortcut(context, shortcut)
      builder
        .setStyle(style(text, target, thread))
        .setShortcutInfo(shortcut)
        .setContentIntent(if (failed != null) broadcast(context, ACTION_RETRY, key, 4, failed.sendKey) else open(context, target))
        .addAction(reply(text, context, key))
        .addAction(
          NotificationCompat.Action.Builder(0, text.getString(R.string.kaitech_message_mark_read), broadcast(context, ACTION_READ, key, 2))
            .setSemanticAction(NotificationCompat.Action.SEMANTIC_ACTION_MARK_AS_READ)
            .setShowsUserInterface(false)
            .build(),
        )
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) builder.setBubbleMetadata(bubble(context, target, thread))
    }
    try {
      manager.notify(key, ID, builder.build())
    } catch (error: SecurityException) {
      return
    }
    summary(context)
  }

  private fun style(context: Context, target: MessageKey, thread: MessageStore.Thread): NotificationCompat.MessagingStyle {
    val me = Person.Builder().setName(context.getString(R.string.kaitech_message_you)).setKey("me").build()
    val group = thread.type != "chat"
    val style = NotificationCompat.MessagingStyle(me).setGroupConversation(group)
    if (group) style.setConversationTitle(thread.title)
    val failed = context.getString(R.string.kaitech_message_failed)
    thread.lines.forEach { line ->
      val body = if (line.mine && line.failed) "${line.text}\n$failed" else line.text
      style.addMessage(NotificationCompat.MessagingStyle.Message(body, line.ts, if (line.mine) null else person(target, line)))
    }
    return style
  }

  private fun person(target: MessageKey, line: MessageStore.Line): Person =
    Person.Builder()
      .setName(line.sender)
      .setKey("${target.account}:${line.senderId}")
      .setIcon(IconCompat.createWithBitmap(avatar(line.sender, line.senderId)))
      .setBot(line.agent)
      .build()

  private fun shortcut(context: Context, text: Context, target: MessageKey, thread: MessageStore.Thread): ShortcutInfoCompat {
    val id = shortcutId(target.value)
    val title = thread.title.ifBlank { text.getString(R.string.kaitech_message_hidden_title) }
    val builder = ShortcutInfoCompat.Builder(context, id)
      .setShortLabel(title)
      .setLongLived(true)
      .setIsConversation()
      .setLocusId(LocusIdCompat(id))
      .setIcon(IconCompat.createWithAdaptiveBitmap(avatar(title, target.channelId, adaptive = true)))
      .setIntent(openIntent(context, target).setAction(ACTION_OPEN))
    if (thread.type == "chat") {
      val other = thread.lines.lastOrNull { !it.mine }
      if (other != null) builder.setPerson(person(target, other))
    }
    return builder.build()
  }

  private fun reply(text: Context, context: Context, key: String): NotificationCompat.Action {
    val input = RemoteInput.Builder(REPLY_KEY).setLabel(text.getString(R.string.kaitech_message_reply_hint)).build()
    val intent = actionIntent(context, ACTION_REPLY, key, 1)
    var flags = PendingIntent.FLAG_UPDATE_CURRENT
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) flags = flags or PendingIntent.FLAG_MUTABLE
    val pending = PendingIntent.getBroadcast(context, 0, intent, flags)
    return NotificationCompat.Action.Builder(0, text.getString(R.string.kaitech_message_reply), pending)
      .addRemoteInput(input)
      .setSemanticAction(NotificationCompat.Action.SEMANTIC_ACTION_REPLY)
      .setShowsUserInterface(false)
      .setAllowGeneratedReplies(true)
      .setAuthenticationRequired(true)
      .build()
  }

  private fun bubble(context: Context, target: MessageKey, thread: MessageStore.Thread): NotificationCompat.BubbleMetadata {
    val intent = Intent(context, BubbleActivity::class.java)
      .setData(Uri.parse("kaitech-bubble://conversation/${Uri.encode(target.value)}"))
      .putExtra(BubbleActivity.EXTRA_DB, target.db)
      .putExtra(BubbleActivity.EXTRA_UID, target.uid)
      .putExtra(BubbleActivity.EXTRA_CHANNEL, target.channelId)
    var flags = PendingIntent.FLAG_UPDATE_CURRENT
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) flags = flags or PendingIntent.FLAG_MUTABLE
    val pending = PendingIntent.getActivity(context, requestCode(target.value), intent, flags)
    val icon = IconCompat.createWithAdaptiveBitmap(avatar(thread.title, target.channelId, adaptive = true))
    return NotificationCompat.BubbleMetadata.Builder(pending, icon).setDesiredHeight(640).build()
  }

  private fun neutral(context: Context, channel: String, unread: Int): android.app.Notification =
    NotificationCompat.Builder(context, channel)
      .setSmallIcon(context.applicationInfo.icon)
      .setContentTitle(context.getString(R.string.kaitech_message_hidden_title))
      .setContentText(context.resources.getQuantityString(R.plurals.kaitech_message_count, unread.coerceAtLeast(1), unread.coerceAtLeast(1)))
      .build()

  private fun summary(context: Context) {
    val manager = context.getSystemService(NotificationManager::class.java) ?: return
    val keys = MessageStore.keys(context)
    if (keys.isEmpty()) {
      manager.cancel(SUMMARY, ID)
      return
    }
    val text = localized(context)
    val threads = keys.mapNotNull { MessageStore.thread(context, it) }
    val unread = threads.sumOf { thread -> thread.lines.count { !it.mine } }.coerceAtLeast(1)
    val count = text.resources.getQuantityString(R.plurals.kaitech_message_count, unread, unread)
    val chats = text.resources.getQuantityString(R.plurals.kaitech_message_chats, threads.size, threads.size)
    val builder = NotificationCompat.Builder(context, MESSAGES)
      .setSmallIcon(context.applicationInfo.icon)
      .setCategory(NotificationCompat.CATEGORY_MESSAGE)
      .setGroup(GROUP)
      .setGroupSummary(true)
      .setGroupAlertBehavior(NotificationCompat.GROUP_ALERT_CHILDREN)
      .setOnlyAlertOnce(true)
      .setAutoCancel(true)
      .setContentTitle(text.getString(R.string.kaitech_message_hidden_title))
      .setContentText(text.getString(R.string.kaitech_message_summary, count, chats))
      .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
      .setPublicVersion(neutral(text, MESSAGES, unread))
    if (!MessageStore.hidden(context)) {
      val inbox = NotificationCompat.InboxStyle().setSummaryText(text.getString(R.string.kaitech_message_summary, count, chats))
      threads.forEach { thread ->
        val last = thread.lines.lastOrNull { !it.mine } ?: return@forEach
        inbox.addLine(if (thread.type == "chat") "${last.sender}: ${last.text}" else "${thread.title} · ${last.sender}: ${last.text}")
      }
      builder.setStyle(inbox)
    }
    try {
      manager.notify(SUMMARY, ID, builder.build())
    } catch (error: SecurityException) {
      return
    }
  }

  fun openIntent(context: Context, target: MessageKey): Intent {
    val launch = context.packageManager.getLaunchIntentForPackage(context.packageName) ?: Intent()
    return Intent(ACTION_OPEN)
      .setComponent(launch.component ?: ComponentName(context.packageName, "${context.packageName}.MainActivity"))
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
      .putExtra(EXTRA_KEY, target.value)
      .also { if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) it.setIdentifier(target.value) }
  }

  private fun open(context: Context, target: MessageKey): PendingIntent {
    var flags = PendingIntent.FLAG_UPDATE_CURRENT
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags = flags or PendingIntent.FLAG_IMMUTABLE
    return PendingIntent.getActivity(context, requestCode(target.value), openIntent(context, target), flags)
  }

  private fun broadcast(context: Context, action: String, key: String, slot: Int, sendKey: String = ""): PendingIntent {
    val intent = actionIntent(context, action, key, slot).putExtra(EXTRA_SEND_KEY, sendKey)
    var flags = PendingIntent.FLAG_UPDATE_CURRENT
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags = flags or PendingIntent.FLAG_IMMUTABLE
    return PendingIntent.getBroadcast(context, 0, intent, flags)
  }

  private fun actionIntent(context: Context, action: String, key: String, slot: Int): Intent =
    Intent(context, MessageActionReceiver::class.java)
      .setAction(action)
      .setData(Uri.Builder().scheme(ACTION_SCHEME).authority(slot.toString()).appendPath(key).build())

  fun keyOf(intent: Intent): String? = intent.data?.takeIf { it.scheme == ACTION_SCHEME }?.pathSegments?.firstOrNull()

  private fun requestCode(key: String) = key.hashCode()

  fun openBubbleSettings(context: Context, key: String) {
    val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      Intent(Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS)
        .putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
        .putExtra(Settings.EXTRA_CHANNEL_ID, MESSAGES)
        .putExtra(Settings.EXTRA_CONVERSATION_ID, shortcutId(key))
    } else {
      Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
    }
    context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
  }

  fun avatar(name: String, seed: Int, adaptive: Boolean = false): Bitmap {
    val size = if (adaptive) AVATAR * 3 / 2 else AVATAR
    val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    paint.color = palette[Math.floorMod(seed, palette.size)]
    if (adaptive) canvas.drawColor(paint.color) else canvas.drawCircle(size / 2f, size / 2f, size / 2f, paint)
    paint.color = Color.WHITE
    paint.textAlign = Paint.Align.CENTER
    paint.textSize = AVATAR * 0.4f
    paint.isFakeBoldText = true
    val initials = name.trim().split(Regex("\\s+")).filter { it.isNotEmpty() }.take(2).joinToString("") { it.take(1).uppercase() }.ifEmpty { "K" }
    val y = size / 2f - (paint.descent() + paint.ascent()) / 2f
    canvas.drawText(initials, size / 2f, y, paint)
    return bitmap
  }
}
