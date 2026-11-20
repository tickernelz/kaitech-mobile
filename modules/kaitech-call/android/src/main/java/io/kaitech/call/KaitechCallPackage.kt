package io.kaitech.call

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import expo.modules.core.interfaces.Package
import expo.modules.core.interfaces.ReactActivityLifecycleListener

class KaitechCallPackage : Package {
  override fun createReactActivityLifecycleListeners(activityContext: Context?): List<ReactActivityLifecycleListener> {
    return listOf(CallActivityListener())
  }
}

class CallActivityListener : ReactActivityLifecycleListener {
  override fun onCreate(activity: Activity, savedInstanceState: Bundle?) {
    apply(activity, activity.intent)
  }

  override fun onNewIntent(intent: Intent): Boolean {
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
    apply(activity, activity.intent)
  }

  private fun apply(activity: Activity, intent: Intent?) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O_MR1) return
    val incoming = CallIntents.isCall(intent)
    activity.setShowWhenLocked(incoming)
    activity.setTurnScreenOn(incoming)
  }
}
