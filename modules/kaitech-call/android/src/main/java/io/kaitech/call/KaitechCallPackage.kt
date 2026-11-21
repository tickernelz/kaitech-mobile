package io.kaitech.call

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import androidx.core.app.OnPictureInPictureModeChangedProvider
import androidx.core.app.PictureInPictureModeChangedInfo
import androidx.core.util.Consumer
import expo.modules.core.interfaces.Package
import expo.modules.core.interfaces.ReactActivityLifecycleListener

class KaitechCallPackage : Package {
  override fun createReactActivityLifecycleListeners(activityContext: Context?): List<ReactActivityLifecycleListener> {
    return listOf(CallActivityListener())
  }
}

class CallActivityListener : ReactActivityLifecycleListener {
  private val pipWatcher = Consumer<PictureInPictureModeChangedInfo> { info -> CallBridge.setPictureInPicture(info.isInPictureInPictureMode) }

  override fun onCreate(activity: Activity, savedInstanceState: Bundle?) {
    apply(activity, activity.intent)
    (activity as? OnPictureInPictureModeChangedProvider)?.addOnPictureInPictureModeChangedListener(pipWatcher)
    CallPip.apply(activity)
  }

  override fun onDestroy(activity: Activity) {
    (activity as? OnPictureInPictureModeChangedProvider)?.removeOnPictureInPictureModeChangedListener(pipWatcher)
  }

  override fun onNewIntent(intent: Intent): Boolean {
    return false
  }

  override fun onUserLeaveHint(activity: Activity) {
    CallPip.onLeaving(activity)
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
