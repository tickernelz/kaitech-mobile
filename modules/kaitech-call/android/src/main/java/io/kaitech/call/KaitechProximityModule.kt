package io.kaitech.call

import android.content.Context
import android.media.AudioDeviceCallback
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class KaitechProximityModule : Module() {
  private val main = Handler(Looper.getMainLooper())
  private var wanted = false
  private var paused = false
  private var lock: PowerManager.WakeLock? = null
  private var watched: AudioManager? = null
  private var routeListener: Any? = null
  private var deviceCallback: AudioDeviceCallback? = null

  override fun definition() = ModuleDefinition {
    Name("KaitechProximity")

    Events(ROUTE_EVENT)

    Function("audioRoute") { route() }

    AsyncFunction("setScreenOff") { enabled: Boolean ->
      wanted = enabled
      refresh()
      lock?.isHeld == true
    }.runOnQueue(Queues.MAIN)

    OnStartObserving { main.post { watchRoute() } }

    OnStopObserving { main.post { unwatchRoute() } }

    OnActivityEntersForeground {
      paused = false
      refresh()
    }

    OnActivityEntersBackground {
      paused = true
      refresh()
    }

    OnActivityDestroys {
      wanted = false
      refresh()
    }

    OnDestroy {
      main.post {
        wanted = false
        refresh()
        unwatchRoute()
      }
    }
  }

  private fun context(): Context? = appContext.reactContext?.applicationContext

  private fun refresh() {
    val pip = appContext.currentActivity?.isInPictureInPictureMode == true
    if (wanted && !paused && !pip) hold() else release()
  }

  private fun hold() {
    if (lock?.isHeld == true) return
    val power = context()?.getSystemService(PowerManager::class.java) ?: return
    if (!power.isWakeLockLevelSupported(PowerManager.PROXIMITY_SCREEN_OFF_WAKE_LOCK)) return
    val next = lock ?: power.newWakeLock(PowerManager.PROXIMITY_SCREEN_OFF_WAKE_LOCK, TAG).also {
      it.setReferenceCounted(false)
      lock = it
    }
    next.acquire()
  }

  private fun release() {
    val held = lock ?: return
    if (held.isHeld) held.release(PowerManager.RELEASE_FLAG_WAIT_FOR_NO_PROXIMITY)
  }

  private fun route(): String {
    val audio = context()?.getSystemService(AudioManager::class.java) ?: return "unknown"
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) return kind(audio.communicationDevice?.type)
    return legacyRoute(audio)
  }

  @Suppress("DEPRECATION")
  private fun legacyRoute(audio: AudioManager): String = when {
    audio.isBluetoothScoOn -> "bluetooth"
    audio.isSpeakerphoneOn -> "speaker"
    audio.isWiredHeadsetOn -> "headset"
    else -> "earpiece"
  }

  private fun kind(type: Int?): String = when (type) {
    null -> "unknown"
    AudioDeviceInfo.TYPE_BUILTIN_EARPIECE -> "earpiece"
    AudioDeviceInfo.TYPE_BUILTIN_SPEAKER, AudioDeviceInfo.TYPE_BUILTIN_SPEAKER_SAFE -> "speaker"
    AudioDeviceInfo.TYPE_BLUETOOTH_SCO, AudioDeviceInfo.TYPE_BLUETOOTH_A2DP, AudioDeviceInfo.TYPE_BLE_HEADSET,
    AudioDeviceInfo.TYPE_BLE_SPEAKER, AudioDeviceInfo.TYPE_HEARING_AID -> "bluetooth"
    AudioDeviceInfo.TYPE_WIRED_HEADSET, AudioDeviceInfo.TYPE_WIRED_HEADPHONES, AudioDeviceInfo.TYPE_USB_HEADSET,
    AudioDeviceInfo.TYPE_USB_DEVICE -> "headset"
    else -> "other"
  }

  private fun watchRoute() {
    if (watched != null) return
    val context = context() ?: return
    val audio = context.getSystemService(AudioManager::class.java) ?: return
    watched = audio
    val callback = object : AudioDeviceCallback() {
      override fun onAudioDevicesAdded(addedDevices: Array<out AudioDeviceInfo>?) = notifyRoute()
      override fun onAudioDevicesRemoved(removedDevices: Array<out AudioDeviceInfo>?) = notifyRoute()
    }
    audio.registerAudioDeviceCallback(callback, main)
    deviceCallback = callback
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      val listener = AudioManager.OnCommunicationDeviceChangedListener { notifyRoute() }
      audio.addOnCommunicationDeviceChangedListener(context.mainExecutor, listener)
      routeListener = listener
    }
  }

  private fun unwatchRoute() {
    val audio = watched ?: return
    deviceCallback?.let { audio.unregisterAudioDeviceCallback(it) }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      (routeListener as? AudioManager.OnCommunicationDeviceChangedListener)?.let { audio.removeOnCommunicationDeviceChangedListener(it) }
    }
    deviceCallback = null
    routeListener = null
    watched = null
  }

  private fun notifyRoute() {
    sendEvent(ROUTE_EVENT, emptyMap<String, Any?>())
  }

  companion object {
    const val ROUTE_EVENT = "onAudioRouteChange"
    const val TAG = "kaitech:call-proximity"
  }
}
