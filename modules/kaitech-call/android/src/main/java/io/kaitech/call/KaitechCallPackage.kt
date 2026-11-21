package io.kaitech.call

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import androidx.core.app.OnPictureInPictureModeChangedProvider
import androidx.core.app.PictureInPictureModeChangedInfo
import androidx.core.util.Consumer
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import com.facebook.react.ReactApplication
import com.facebook.react.modules.core.DefaultHardwareBackBtnHandler
import expo.modules.core.interfaces.Package
import expo.modules.core.interfaces.ReactActivityLifecycleListener
import java.lang.ref.WeakReference

class KaitechCallPackage : Package {
  override fun createReactActivityLifecycleListeners(activityContext: Context?): List<ReactActivityLifecycleListener> {
    return listOf(CallActivityListener())
  }
}

class CallActivityListener : ReactActivityLifecycleListener {
  private var host = WeakReference<Activity>(null)
  private val pipWatcher = Consumer<PictureInPictureModeChangedInfo> { info ->
    host.get()?.let { activity -> activity.window.decorView.post { keepRendering(activity, info.isInPictureInPictureMode) } }
    CallBridge.setPictureInPicture(info.isInPictureInPictureMode)
  }

  override fun onCreate(activity: Activity, savedInstanceState: Bundle?) {
    host = WeakReference(activity)
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

  private fun keepRendering(activity: Activity, pinned: Boolean) {
    val reactHost = (activity.application as? ReactApplication)?.reactHost ?: return
    val resumed = (activity as? LifecycleOwner)?.lifecycle?.currentState?.isAtLeast(Lifecycle.State.RESUMED) ?: true
    if (resumed || activity.isFinishing) return
    if (pinned) reactHost.onHostResume(activity, activity as? DefaultHardwareBackBtnHandler) else reactHost.onHostPause(activity)
  }

  override fun onPause(activity: Activity) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    activity.window.decorView.post { if (activity.isInPictureInPictureMode) keepRendering(activity, true) }
  }

  private fun apply(activity: Activity, intent: Intent?) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O_MR1) return
    val incoming = CallIntents.isCall(intent)
    activity.setShowWhenLocked(incoming)
    activity.setTurnScreenOn(incoming)
  }
}
