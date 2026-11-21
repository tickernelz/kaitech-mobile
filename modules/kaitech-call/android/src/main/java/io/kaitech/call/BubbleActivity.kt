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

  override fun onResume() {
    super.onResume()
    MessageStore.bubbleKey = MessageKey.of(intent.getStringExtra(EXTRA_DB).orEmpty(), intent.getIntExtra(EXTRA_UID, 0), intent.getIntExtra(EXTRA_CHANNEL, 0))
  }

  override fun onPause() {
    MessageStore.bubbleKey = null
    super.onPause()
  }

  companion object {
    const val COMPONENT = "KaitechBubble"
    const val EXTRA_DB = "io.kaitech.bubble.db"
    const val EXTRA_UID = "io.kaitech.bubble.uid"
    const val EXTRA_CHANNEL = "io.kaitech.bubble.channelId"
  }
}
