package io.kaitech.call

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.Person

object CallNotifications {
  const val RING_CHANNEL = "kaitech_calls_ringing"
  const val CALL_CHANNEL = "kaitech_calls_active"
  const val RING_ID = 7101
  const val CALL_ID = 7102

  fun ensureChannels(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = context.getSystemService(NotificationManager::class.java) ?: return
    val ring = NotificationChannel(RING_CHANNEL, context.getString(R.string.kaitech_call_ring_channel), NotificationManager.IMPORTANCE_HIGH).apply {
      description = context.getString(R.string.kaitech_call_ring_description)
      lockscreenVisibility = Notification.VISIBILITY_PUBLIC
      setSound(null, null)
      enableVibration(false)
    }
    val active = NotificationChannel(CALL_CHANNEL, context.getString(R.string.kaitech_call_active_channel), NotificationManager.IMPORTANCE_LOW).apply {
      description = context.getString(R.string.kaitech_call_active_description)
      lockscreenVisibility = Notification.VISIBILITY_PUBLIC
      setSound(null, null)
      enableVibration(false)
    }
    manager.createNotificationChannel(ring)
    manager.createNotificationChannel(active)
  }

  private fun person(name: String): Person = Person.Builder().setName(name.ifBlank { "Kaitech" }).build()

  private fun pending(context: Context, requestCode: Int, intent: Intent): PendingIntent {
    var flags = PendingIntent.FLAG_UPDATE_CURRENT
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags = flags or PendingIntent.FLAG_IMMUTABLE
    return PendingIntent.getActivity(context, requestCode, intent, flags)
  }

  private fun action(context: Context, requestCode: Int, name: String, ring: CallService.Ring): PendingIntent {
    val intent = Intent(context, CallActionReceiver::class.java).setAction(name)
    CallIntents.fill(intent, ring)
    var flags = PendingIntent.FLAG_UPDATE_CURRENT
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags = flags or PendingIntent.FLAG_IMMUTABLE
    return PendingIntent.getBroadcast(context, requestCode, intent, flags)
  }

  private fun publicVersion(context: Context): Notification =
    NotificationCompat.Builder(context, CALL_CHANNEL)
      .setSmallIcon(context.applicationInfo.icon)
      .setContentTitle(context.getString(R.string.kaitech_call_hidden_title))
      .setPriority(NotificationCompat.PRIORITY_MIN)
      .setSilent(true)
      .build()

  private fun visible(): Int =
    if (CallBridge.module != null && CallBridge.foreground && !CallBridge.locked) Notification.VISIBILITY_PUBLIC
    else Notification.VISIBILITY_PRIVATE

  fun ringing(context: Context, ring: CallService.Ring, timeoutMs: Long): Notification {
    ensureChannels(context)
    val open = pending(context, RING_ID, CallIntents.openIntent(context, answer = false, ring))
    val fullScreen = pending(context, RING_ID + 100, CallIntents.openIntent(context, answer = false, ring))
    val answer = pending(context, RING_ID + 2, CallIntents.openIntent(context, answer = true, ring))
    val builder = NotificationCompat.Builder(context, RING_CHANNEL)
      .setSmallIcon(context.applicationInfo.icon)
      .setContentTitle(ring.title)
      .setContentText(ring.body)
      .setCategory(NotificationCompat.CATEGORY_CALL)
      .setPriority(NotificationCompat.PRIORITY_MAX)
      .setVisibility(visible())
      .setPublicVersion(publicVersion(context))
      .setOngoing(true)
      .setAutoCancel(false)
      .setOnlyAlertOnce(true)
      .setTimeoutAfter(timeoutMs)
      .setContentIntent(open)
      .setFullScreenIntent(fullScreen, true)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      val decline = action(context, RING_ID + 1, CallNotifications.ACTION_DECLINE, ring)
      builder.setStyle(NotificationCompat.CallStyle.forIncomingCall(person(ring.title), decline, answer))
    } else {
      builder.addAction(0, context.getString(R.string.kaitech_call_decline), action(context, RING_ID + 1, CallNotifications.ACTION_DECLINE, ring))
      builder.addAction(0, context.getString(R.string.kaitech_call_answer), answer)
      builder.setStyle(NotificationCompat.BigTextStyle().bigText(ring.body))
    }
    return builder.build()
  }

  fun ongoing(context: Context, call: CallService.Ongoing): Notification {
    ensureChannels(context)
    val open = pending(context, CALL_ID, CallIntents.openIntent(context, answer = false, call.ring()))
    val builder = NotificationCompat.Builder(context, CALL_CHANNEL)
      .setSmallIcon(context.applicationInfo.icon)
      .setContentTitle(call.title)
      .setContentText(call.body)
      .setCategory(NotificationCompat.CATEGORY_CALL)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .setVisibility(visible())
      .setPublicVersion(publicVersion(context))
      .setOngoing(true)
      .setShowWhen(true)
      .setWhen(call.startedAt)
      .setUsesChronometer(true)
      .setContentIntent(open)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      var flags = PendingIntent.FLAG_UPDATE_CURRENT
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags = flags or PendingIntent.FLAG_IMMUTABLE
      val hangup = Intent(context, CallActionReceiver::class.java).setAction(ACTION_HANGUP)
      val end = PendingIntent.getBroadcast(context, CALL_ID + 1, hangup, flags)
      builder.setStyle(NotificationCompat.CallStyle.forOngoingCall(person(call.title), end))
    }
    if (call.sharing) {
      var flags = PendingIntent.FLAG_UPDATE_CURRENT
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags = flags or PendingIntent.FLAG_IMMUTABLE
      val stop = Intent(context, CallActionReceiver::class.java).setAction(ACTION_STOP_SHARING)
      builder.addAction(0, context.getString(R.string.kaitech_call_stop_sharing), PendingIntent.getBroadcast(context, CALL_ID + 2, stop, flags))
    }
    return builder.build()
  }

  fun silent(context: Context, title: String, text: String): Notification {
    ensureChannels(context)
    return NotificationCompat.Builder(context, CALL_CHANNEL)
      .setSmallIcon(context.applicationInfo.icon)
      .setContentTitle(title)
      .setContentText(text)
      .setPriority(NotificationCompat.PRIORITY_MIN)
      .setSilent(true)
      .setOngoing(true)
      .build()
  }

  fun active(context: Context, id: Int): Boolean {
    val manager = context.getSystemService(android.app.NotificationManager::class.java) ?: return false
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return false
    return manager.activeNotifications.any { it.id == id }
  }

  fun cancel(context: Context, id: Int) {
    NotificationManagerCompat.from(context).cancel(id)
  }

  const val ACTION_DECLINE = "io.kaitech.call.DECLINE"
  const val ACTION_HANGUP = "io.kaitech.call.HANGUP"
  const val ACTION_STOP_SHARING = "io.kaitech.call.STOP_SHARING"
}
