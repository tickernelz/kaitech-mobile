package io.kaitech.call

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import com.facebook.react.bridge.ReactContext
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class KaitechCallModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("KaitechCall")

    Events(EVENT, MESSAGE_EVENT)

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
      CallKeepAlive.set(appContext.reactContext as? ReactContext, value)
      CallPip.apply(appContext.currentActivity)
      true
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("setLocked") { value: Boolean -> CallBridge.setLocked(value) }

    AsyncFunction("setCallSurface") { visible: Boolean ->
      CallBridge.callSurface = visible
      val activity = appContext.currentActivity ?: return@AsyncFunction false
      activity.runOnUiThread { CallKeyguard.apply(activity) }
      true
    }

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

    AsyncFunction("setMessagesHidden") { value: Boolean ->
      MessageNotifications.setHidden(requireContext(), value)
      true
    }

    AsyncFunction("setMessageLanguage") { value: String ->
      MessageStore.setLanguage(requireContext(), value)
      true
    }

    AsyncFunction("setMutedConversations") { db: String, uid: Int, channelIds: List<Int>, until: List<Double> ->
      MessageStore.setMuted(requireContext(), MessageKey.account(db, uid), channelIds.zip(until.map { it.toLong() }).toMap())
      true
    }

    AsyncFunction("setOpenConversations") { db: String, uid: Int, channelIds: List<Int> ->
      val keys = channelIds.map { MessageKey.of(db, uid, it) }.toSet()
      MessageStore.openKeys = keys
      keys.filter { it != MessageStore.bubbleKey }.forEach { MessageNotifications.clear(requireContext(), it) }
      true
    }

    AsyncFunction("clearConversation") { db: String, uid: Int, channelId: Int ->
      MessageNotifications.clear(requireContext(), MessageKey.of(db, uid, channelId))
      true
    }

    AsyncFunction("clearAccountMessages") { db: String, uid: Int ->
      MessageNotifications.clearAccount(requireContext(), MessageKey.account(db, uid))
      true
    }

    AsyncFunction("messageResult") { db: String, uid: Int, channelId: Int, sendKey: String, ok: Boolean ->
      val context = requireContext()
      val key = MessageKey.of(db, uid, channelId)
      if (MessageStore.settle(context, key, sendKey, failed = !ok) != null) MessageNotifications.refresh(context, key, onlyIfShown = ok)
      true
    }

    AsyncFunction("openBubbleSettings") { db: String, uid: Int, channelId: Int ->
      MessageNotifications.openBubbleSettings(requireContext(), MessageKey.of(db, uid, channelId))
      true
    }

    AsyncFunction("takeMessageOpen") { MessageIntents.take(appContext.currentActivity) }

    AsyncFunction("canUseFullScreenIntent") { canUseFullScreenIntent() }

    AsyncFunction("openFullScreenIntentSettings") {
      openFullScreenIntentSettings()
      true
    }
  }

  fun dispatch(action: Map<String, Any?>) {
    sendEvent(EVENT, action)
  }

  fun dispatchMessageOpen() {
    sendEvent(MESSAGE_EVENT, emptyMap<String, Any?>())
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
    const val MESSAGE_EVENT = "onMessageOpen"
  }
}
