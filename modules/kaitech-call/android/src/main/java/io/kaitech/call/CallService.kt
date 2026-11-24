package io.kaitech.call

import android.app.Notification
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.Log

class CallService : Service() {
  private var player: MediaPlayer? = null
  private val main = Handler(Looper.getMainLooper())
  private val timeout = Runnable {
    MessageNotifications.missed(this, ringingKey)
    stopEverything()
  }
  private var foreground = false

  data class Ring(
    val title: String,
    val body: String,
    val channelId: Int,
    val callId: Int,
    val db: String,
    val uid: Int,
    val system: Boolean,
    val timeoutMs: Long = 45_000,
  )

  data class Ongoing(
    val title: String,
    val body: String,
    val channelId: Int,
    val muted: Boolean,
    val camera: Boolean,
    val sharing: Boolean = false,
    val startedAt: Long = System.currentTimeMillis(),
  ) {
    fun ring() = Ring(title, body, channelId, 0, "", 0, system = false)
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_RING -> startRing(intent)
      ACTION_CALL -> startCall(intent)
      else -> stopEverything()
    }
    return START_NOT_STICKY
  }

  private fun startRing(intent: Intent) {
    val ring = Ring(
      intent.getStringExtra(EXTRA_TITLE) ?: "Kaitech",
      intent.getStringExtra(EXTRA_BODY) ?: "",
      intent.getIntExtra(CallIntents.EXTRA_CHANNEL_ID, 0),
      intent.getIntExtra(CallIntents.EXTRA_CALL_ID, 0),
      intent.getStringExtra(CallIntents.EXTRA_DB) ?: "",
      intent.getIntExtra(CallIntents.EXTRA_UID, 0),
      system = true,
    )
    if (ring.channelId <= 0) {
      stopEverything()
      return
    }
    ringingChannel = ring.channelId
    ringingKey = MessageKey.of(ring.db, ring.uid, ring.channelId)
    startForegroundCompat(CallNotifications.ringing(this, ring, ring.timeoutMs), CallNotifications.RING_ID, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
    playRingtone()
    main.removeCallbacks(timeout)
    main.postDelayed(timeout, ring.timeoutMs)
  }

  private fun startCall(intent: Intent) {
    val call = Ongoing(
      intent.getStringExtra(EXTRA_TITLE) ?: "Kaitech",
      intent.getStringExtra(EXTRA_BODY) ?: "",
      intent.getIntExtra(CallIntents.EXTRA_CHANNEL_ID, 0),
      intent.getBooleanExtra(EXTRA_MUTED, false),
      intent.getBooleanExtra(EXTRA_CAMERA, false),
      intent.getBooleanExtra(EXTRA_SHARING, false),
    )
    ringingChannel = 0
    ringingKey = ""
    stopRingtone()
    main.removeCallbacks(timeout)
    val type = if (call.camera) {
      ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE or ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA
    } else {
      ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
    }
    startForegroundCompat(CallNotifications.ongoing(this, call), CallNotifications.CALL_ID, type)
  }

  private fun startForegroundCompat(notification: Notification, id: Int, type: Int) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) startForeground(id, notification, type)
    else startForeground(id, notification)
    foreground = true
  }

  private fun playRingtone() {
    stopRingtone()
    val uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE) ?: return
    try {
      player = MediaPlayer().apply {
        setAudioAttributes(
          AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build(),
        )
        setDataSource(this@CallService, uri)
        isLooping = true
        prepare()
        start()
      }
    } catch (error: Exception) {
      Log.w(TAG, "ringtone unavailable", error)
      player?.release()
      player = null
    }
  }

  private fun stopRingtone() {
    player?.let { held ->
      try {
        if (held.isPlaying) held.stop()
      } catch (error: IllegalStateException) {
        Log.w(TAG, "ringtone already stopped", error)
      }
      held.release()
    }
    player = null
  }

  private fun stopEverything() {
    ringingChannel = 0
    ringingKey = ""
    main.removeCallbacks(timeout)
    stopRingtone()
    if (foreground) {
      stopForeground(STOP_FOREGROUND_REMOVE)
      foreground = false
    }
    CallNotifications.cancel(this, CallNotifications.RING_ID)
    CallNotifications.cancel(this, CallNotifications.CALL_ID)
    stopSelf()
  }

  override fun onDestroy() {
    stopEverything()
    super.onDestroy()
  }

  companion object {
    private const val TAG = "KaitechCall"
    private const val EXTRA_TITLE = "kaitech.call.notificationTitle"
    private const val EXTRA_BODY = "kaitech.call.notificationBody"
    private const val EXTRA_MUTED = "kaitech.call.muted"
    private const val EXTRA_CAMERA = "kaitech.call.camera"
    private const val EXTRA_SHARING = "kaitech.call.sharing"
    const val ACTION_RING = "io.kaitech.call.RING"
    const val ACTION_CALL = "io.kaitech.call.CALL"
    const val ACTION_STOP = "io.kaitech.call.STOP"

    @Volatile
    private var ringingChannel = 0
    private var ringingKey = ""

    fun ringing(context: Context): Boolean = CallNotifications.active(context, CallNotifications.RING_ID)

    fun isRinging(key: String): Boolean = key.isNotEmpty() && key == ringingKey

    fun ring(context: Context, ring: Ring) {
      ringingChannel = ring.channelId
      ringingKey = MessageKey.of(ring.db, ring.uid, ring.channelId)
      val intent = Intent(context, CallService::class.java)
        .setAction(ACTION_RING)
        .putExtra(EXTRA_TITLE, ring.title)
        .putExtra(EXTRA_BODY, ring.body)
        .putExtra(EXTRA_MUTED, false)
        .putExtra(EXTRA_CAMERA, false)
      CallIntents.fill(intent, ring)
      start(context, intent)
    }

    fun call(context: Context, call: Ongoing) {
      val intent = Intent(context, CallService::class.java)
        .setAction(ACTION_CALL)
        .putExtra(EXTRA_TITLE, call.title)
        .putExtra(EXTRA_BODY, call.body)
        .putExtra(EXTRA_MUTED, call.muted)
        .putExtra(EXTRA_CAMERA, call.camera)
        .putExtra(EXTRA_SHARING, call.sharing)
      CallIntents.fill(intent, call.ring())
      start(context, intent)
    }

    fun stop(context: Context) {
      context.stopService(Intent(context, CallService::class.java))
      CallNotifications.cancel(context, CallNotifications.RING_ID)
      CallNotifications.cancel(context, CallNotifications.CALL_ID)
    }

    fun cancelRing(context: Context, channelId: Int) {
      if (channelId != ringingChannel) return
      ringingChannel = 0
    ringingKey = ""
      CallNotifications.cancel(context, CallNotifications.RING_ID)
      stop(context)
    }

    private fun start(context: Context, intent: Intent) {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(intent) else context.startService(intent)
    }
  }
}
