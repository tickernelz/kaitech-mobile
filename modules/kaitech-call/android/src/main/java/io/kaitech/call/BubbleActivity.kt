package io.kaitech.call

import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultReactActivityDelegate

class BubbleActivity : ReactActivity() {
  override fun getMainComponentName(): String = COMPONENT

  override fun createReactActivityDelegate(): ReactActivityDelegate =
    object : DefaultReactActivityDelegate(this, COMPONENT) {
      override fun getLaunchOptions(): Bundle =
        Bundle().apply {
          putString("db", intent.getStringExtra(EXTRA_DB).orEmpty())
          putInt("uid", intent.getIntExtra(EXTRA_UID, 0))
          putInt("channelId", intent.getIntExtra(EXTRA_CHANNEL, 0))
        }
    }

  companion object {
    const val COMPONENT = "KaitechBubble"
    const val EXTRA_DB = "io.kaitech.bubble.db"
    const val EXTRA_UID = "io.kaitech.bubble.uid"
    const val EXTRA_CHANNEL = "io.kaitech.bubble.channelId"
  }
}
