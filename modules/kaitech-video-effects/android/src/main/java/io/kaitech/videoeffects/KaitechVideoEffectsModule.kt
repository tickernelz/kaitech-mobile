package io.kaitech.videoeffects

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import io.livekit.reactnative.webrtc.videoEffects.ProcessorProvider
import io.livekit.reactnative.webrtc.videoEffects.VideoFrameProcessorFactoryInterface

const val BLUR = "kaitechBackgroundBlur"

class KaitechVideoEffectsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("KaitechVideoEffects")

    OnCreate {
      ProcessorProvider.addProcessor(BLUR, VideoFrameProcessorFactoryInterface { BlurProcessor() })
    }

    Function("blurName") {
      BLUR
    }

    Function("clearBlur") {
      Segmenter.clear()
    }
  }
}
