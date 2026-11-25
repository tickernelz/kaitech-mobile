package io.kaitech.refresh

import android.view.View
import android.view.ViewGroup
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class KaitechRefreshModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("KaitechRefresh")

    AsyncFunction("releaseIndicatorTouches") { layout: ViewGroup ->
      for (index in 0 until layout.childCount) {
        val child = layout.getChildAt(index)
        if (child.id == View.NO_ID) child.isEnabled = false
      }
    }.runOnQueue(Queues.MAIN)
  }
}
