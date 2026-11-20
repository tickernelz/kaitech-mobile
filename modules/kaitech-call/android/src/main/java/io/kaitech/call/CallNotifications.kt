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
    val ring = NotificationChannel(RING_CHANNEL, "Panggilan masuk", NotificationManager.IMPORTANCE_HIGH).apply {
      description = "Dering panggilan suara dan video"
      lockscreenVisibility = Notification.VISIBILITY_PUBLIC
      setSound(null, null)
      enableVibration(false)
    }
    val active = NotificationChannel(CALL_CHANNEL, "Panggilan berlangsung", NotificationManager.IMPORTANCE_LOW).apply {
      description = "Kontrol panggilan yang sedang berjalan"
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

  private fun publicVersion(context: Context, title: String): Notification =
    NotificationCompat.Builder(context, CALL_CHANNEL)
      .setSmallIcon(context.applicationInfo.icon)
      .setContentTitle(title)
      .setPriority(NotificationCompat.PRIORITY_MIN)
      .setSilent(true)
      .build()

  private fun visible(context: Context, title: String): Int =
    if (CallBridge.locked) Notification.VISIBILITY_PRIVATE else Notification.VISIBILITY_PUBLIC

  fun ringing(context: Context, ring: CallService.Ring, timeoutMs: Long): Notification {
    ensureChannels(context)
    val open = pending(context, RING_ID, CallIntents.openIntent(context, answer = false, ring))
    val fullScreen = pending(context, RING_ID + 100, CallIntents.openIntent(context, answer = false, ring))
    val builder = NotificationCompat.Builder(context, RING_CHANNEL)
      .setSmallIcon(context.applicationInfo.icon)
      .setContentTitle(ring.title)
      .setContentText(ring.body)
      .setCategory(NotificationCompat.CATEGORY_CALL)
      .setPriority(NotificationCompat.PRIORITY_MAX)
      .setVisibility(visible(context, ring.title))
      .setPublicVersion(publicVersion(context, "Kaitech"))
      .setOngoing(true)
      .setAutoCancel(false)
      .setOnlyAlertOnce(true)
      .setSilent(true)
      .setTimeoutAfter(timeoutMs)
      .setContentIntent(open)
      .setFullScreenIntent(fullScreen, true)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      val decline = action(context, RING_ID + 1, CallNotifications.ACTION_DECLINE, ring)
      val answer = action(context, RING_ID + 2, CallNotifications.ACTION_ANSWER, ring)
      builder.setStyle(NotificationCompat.CallStyle.forIncomingCall(person(ring.title), decline, answer))
    } else {
      builder.addAction(0, "Tolak", action(context, RING_ID + 1, CallNotifications.ACTION_DECLINE, ring))
      builder.addAction(0, "Terima", action(context, RING_ID + 2, CallNotifications.ACTION_ANSWER, ring))
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
      .setVisibility(visible(context, call.title))
      .setPublicVersion(publicVersion(context, "Kaitech"))
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
  const val ACTION_ANSWER = "io.kaitech.call.ANSWER"
  const val ACTION_HANGUP = "io.kaitech.call.HANGUP"
}
