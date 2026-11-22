package io.kaitech.videoeffects

import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailabilityLight
import expo.modules.kotlin.Promise
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

    Function("blurAvailable") {
      val context = appContext.reactContext ?: return@Function false
      GoogleApiAvailabilityLight.getInstance().isGooglePlayServicesAvailable(context) == ConnectionResult.SUCCESS
    }

    AsyncFunction("prepareBlur") { promise: Promise ->
      val context = appContext.reactContext
      if (context == null) {
        promise.resolve(false)
        return@AsyncFunction
      }
      Segmenter.prepare(context) { ready -> promise.resolve(ready) }
    }

    Function("blurName") {
      BLUR
    }

    Function("clearBlur") {
      Segmenter.clear()
    }
  }
}
