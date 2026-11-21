package io.kaitech.call

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.jstasks.HeadlessJsTaskConfig
import com.facebook.react.jstasks.HeadlessJsTaskContext

object CallKeepAlive {
  private const val TASK = "KaitechCallKeepAlive"
  private var taskId = 0

  fun set(context: ReactContext?, inCall: Boolean) {
    val tasks = context?.let { HeadlessJsTaskContext.getInstance(it) } ?: return
    val running = taskId != 0 && tasks.isTaskRunning(taskId)
    if (inCall && !running && context.hasActiveReactInstance()) {
      taskId = tasks.startTask(HeadlessJsTaskConfig(TASK, Arguments.createMap(), 0, true))
    } else if (!inCall && running) {
      tasks.finishTask(taskId)
      taskId = 0
    }
  }
}
