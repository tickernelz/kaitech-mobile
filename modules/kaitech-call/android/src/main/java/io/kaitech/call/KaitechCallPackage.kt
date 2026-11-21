package io.kaitech.call

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import expo.modules.core.interfaces.Package
import expo.modules.core.interfaces.ReactActivityLifecycleListener
import java.lang.ref.WeakReference

class KaitechCallPackage : Package {
  override fun createReactActivityLifecycleListeners(activityContext: Context?): List<ReactActivityLifecycleListener> {
    return listOf(CallActivityListener(activityContext as? Activity))
  }
}

class CallActivityListener(activity: Activity?) : ReactActivityLifecycleListener {
  private val owner = WeakReference(activity)

  override fun onCreate(activity: Activity, savedInstanceState: Bundle?) {
    CallKeyguard.apply(activity)
  }

  override fun onNewIntent(intent: Intent): Boolean {
    if (MessageIntents.isOpen(intent)) {
      owner.get()?.intent = intent
      CallBridge.module?.dispatchMessageOpen()
      return false
    }
    if (!CallIntents.isCall(intent)) return false
    val activity = owner.get() ?: return false
    activity.intent = intent
    CallKeyguard.apply(activity)
    return false
  }

  override fun onUserLeaveHint(activity: Activity) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    if (!CallBridge.inCall || CallBridge.pipRequested) return
    if (activity.isInPictureInPictureMode) return
    val params = android.app.PictureInPictureParams.Builder().build()
    activity.enterPictureInPictureMode(params)
  }

  override fun onResume(activity: Activity) {
    CallKeyguard.apply(activity)
  }
}

object CallKeyguard {
  fun apply(activity: Activity) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O_MR1) return
    val show = CallIntents.isCall(activity.intent) || CallBridge.callSurface
    activity.setShowWhenLocked(show)
    activity.setTurnScreenOn(show)
  }
}
