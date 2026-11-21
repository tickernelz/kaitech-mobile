package io.kaitech.call

import android.app.Activity
import android.app.PendingIntent
import android.app.PictureInPictureParams
import android.app.RemoteAction
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Rect
import android.graphics.drawable.Icon
import android.os.Build
import android.util.Log
import android.util.Rational
import androidx.annotation.RequiresApi

object CallPip {
  data class Spec(
    val enabled: Boolean = false,
    val width: Int = 3,
    val height: Int = 4,
    val muted: Boolean = false,
    val camera: Boolean = false,
    val video: Boolean = false,
    val sharing: Boolean = false,
    val hint: Rect? = null,
  )

  @Volatile
  var spec = Spec()

  @Volatile
  var active = false

  private const val TAG = "KaitechCall"
  private const val WIDEST = 2.39

  fun supported(context: Context?): Boolean =
    Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
      context?.packageManager?.hasSystemFeature(PackageManager.FEATURE_PICTURE_IN_PICTURE) == true

  fun ratio(width: Int, height: Int): Rational {
    if (width <= 0 || height <= 0) return Rational(3, 4)
    val value = width.toDouble() / height
    return when {
      value > WIDEST -> Rational(239, 100)
      value < 1 / WIDEST -> Rational(100, 239)
      else -> Rational(width, height)
    }
  }

  fun hint(activity: Activity, x: Int, y: Int, width: Int, height: Int): Rect? {
    if (width <= 0 || height <= 0) return null
    val density = activity.resources.displayMetrics.density
    return Rect((x * density).toInt(), (y * density).toInt(), ((x + width) * density).toInt(), ((y + height) * density).toInt())
  }

  fun apply(activity: Activity?) {
    if (activity == null || !supported(activity)) return
    try {
      activity.setPictureInPictureParams(params(activity))
    } catch (error: RuntimeException) {
      Log.w(TAG, "picture-in-picture params rejected", error)
    }
  }

  fun enter(activity: Activity?): Boolean {
    if (activity == null || !supported(activity)) return false
    if (activity.isInPictureInPictureMode) return true
    return try {
      activity.enterPictureInPictureMode(params(activity))
    } catch (error: RuntimeException) {
      Log.w(TAG, "picture-in-picture refused", error)
      false
    }
  }

  fun leave(activity: Activity?) {
    if (activity == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    if (activity.isInPictureInPictureMode) activity.moveTaskToBack(false)
  }

  fun onLeaving(activity: Activity) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) return
    if (!CallBridge.inCall || !spec.enabled) return
    enter(activity)
  }

  @RequiresApi(Build.VERSION_CODES.O)
  private fun params(activity: Activity): PictureInPictureParams {
    val current = spec
    val builder = PictureInPictureParams.Builder()
      .setAspectRatio(ratio(current.width, current.height))
      .setActions(actions(activity, current).take(activity.maxNumPictureInPictureActions))
    current.hint?.let { builder.setSourceRectHint(it) }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      builder.setAutoEnterEnabled(current.enabled && CallBridge.inCall)
      builder.setSeamlessResizeEnabled(true)
    }
    return builder.build()
  }

  @RequiresApi(Build.VERSION_CODES.O)
  private fun actions(context: Context, current: Spec): List<RemoteAction> {
    val out = mutableListOf(
      if (current.muted) {
        action(context, R.drawable.kaitech_call_mic_off, R.string.kaitech_call_unmute, ACTION_TOGGLE_MUTE, 1)
      } else {
        action(context, R.drawable.kaitech_call_mic, R.string.kaitech_call_mute, ACTION_TOGGLE_MUTE, 1)
      },
    )
    if (current.sharing) {
      out += action(context, R.drawable.kaitech_call_stop_share, R.string.kaitech_call_stop_sharing, CallNotifications.ACTION_STOP_SHARING, 2)
    } else if (current.video) {
      out += if (current.camera) {
        action(context, R.drawable.kaitech_call_videocam, R.string.kaitech_call_camera_off, ACTION_TOGGLE_CAMERA, 2)
      } else {
        action(context, R.drawable.kaitech_call_videocam_off, R.string.kaitech_call_camera_on, ACTION_TOGGLE_CAMERA, 2)
      }
    }
    out += action(context, R.drawable.kaitech_call_end, R.string.kaitech_call_hang_up, CallNotifications.ACTION_HANGUP, 3)
    return out
  }

  @RequiresApi(Build.VERSION_CODES.O)
  private fun action(context: Context, icon: Int, label: Int, name: String, code: Int): RemoteAction {
    val intent = Intent(context, CallActionReceiver::class.java).setAction(name)
    val pending = PendingIntent.getBroadcast(context, REQUEST_BASE + code, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    val text = context.getString(label)
    return RemoteAction(Icon.createWithResource(context, icon), text, text, pending)
  }

  const val ACTION_TOGGLE_MUTE = "io.kaitech.call.TOGGLE_MUTE"
  const val ACTION_TOGGLE_CAMERA = "io.kaitech.call.TOGGLE_CAMERA"
  private const val REQUEST_BASE = 7200
}
