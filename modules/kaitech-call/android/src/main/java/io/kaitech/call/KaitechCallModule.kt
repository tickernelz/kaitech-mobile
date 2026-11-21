package io.kaitech.call

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class KaitechCallModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("KaitechCall")

    Events(EVENT)

    OnCreate {
      CallBridge.module = this@KaitechCallModule
    }

    OnDestroy {
      if (CallBridge.module === this@KaitechCallModule) CallBridge.module = null
    }

    OnActivityEntersForeground {
      CallBridge.foreground = true
    }

    OnActivityEntersBackground {
      CallBridge.foreground = false
    }

    AsyncFunction("takePending") { CallBridge.takePending() }


    AsyncFunction("takeLaunchAction") { CallIntents.takeLaunch(appContext) }

    AsyncFunction("ring") { title: String, body: String, channelId: Int, callId: Int, video: Boolean, db: String, uid: Int ->
      CallService.ring(requireContext(), CallService.Ring(title, body, channelId, callId, video, db, uid, system = true))
      true
    }

    AsyncFunction("ringing") { CallService.ringing(requireContext()) }

    AsyncFunction("cancelRing") { channelId: Int ->
      CallService.cancelRing(requireContext(), channelId)
      true
    }

    AsyncFunction("startCall") { video: Boolean, title: String, body: String, channelId: Int ->
      CallService.call(requireContext(), CallService.Ongoing(video, title, body, channelId, muted = false, camera = video))
      true
    }

    AsyncFunction("updateCall") { video: Boolean, title: String, body: String, channelId: Int, muted: Boolean, camera: Boolean, sharing: Boolean ->
      CallService.call(requireContext(), CallService.Ongoing(video, title, body, channelId, muted, camera, sharing))
      true
    }

    AsyncFunction("setInCall") { value: Boolean ->
      CallBridge.setInCall(value)
      CallPip.apply(appContext.currentActivity)
      true
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("setLocked") { value: Boolean -> CallBridge.setLocked(value) }

    AsyncFunction("stopCall") {
      CallService.stop(requireContext())
      true
    }

    Constant("pictureInPictureSupported") { CallPip.supported(appContext.reactContext) }

    AsyncFunction("enterPictureInPicture") { CallPip.enter(appContext.currentActivity) }.runOnQueue(Queues.MAIN)

    AsyncFunction("leavePictureInPicture") {
      CallPip.leave(appContext.currentActivity)
      true
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("setPictureInPicture") { enabled: Boolean, width: Int, height: Int, muted: Boolean, camera: Boolean, video: Boolean, sharing: Boolean ->
      CallPip.spec = CallPip.spec.copy(enabled = enabled, width = width, height = height, muted = muted, camera = camera, video = video, sharing = sharing)
      CallPip.apply(appContext.currentActivity)
      true
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("setPictureInPictureHint") { x: Int, y: Int, width: Int, height: Int ->
      val activity = appContext.currentActivity ?: return@AsyncFunction false
      CallPip.spec = CallPip.spec.copy(hint = CallPip.hint(activity, x, y, width, height))
      CallPip.apply(activity)
      true
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("canUseFullScreenIntent") { canUseFullScreenIntent() }

    AsyncFunction("openFullScreenIntentSettings") {
      openFullScreenIntentSettings()
      true
    }
  }

  fun dispatch(action: Map<String, Any?>) {
    sendEvent(EVENT, action)
  }

  private fun requireContext() = appContext.reactContext ?: throw IllegalStateException("no react context")

  private fun canUseFullScreenIntent(): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) return true
    val manager = appContext.reactContext?.getSystemService(android.app.NotificationManager::class.java)
    return manager?.canUseFullScreenIntent() ?: false
  }

  private fun openFullScreenIntentSettings() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) return
    val context = requireContext()
    val intent = Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, Uri.parse("package:" + context.packageName))
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    context.startActivity(intent)
  }

  companion object {
    const val EVENT = "onCallAction"
  }
}
