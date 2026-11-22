package io.kaitech.videoeffects

import android.content.Context
import android.os.SystemClock
import android.util.Log
import com.google.android.gms.tflite.java.TfLite
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean
import org.tensorflow.lite.InterpreterApi

class Mask(val width: Int, val height: Int, val rotation: Int, val frameWidth: Int, val frameHeight: Int, val alpha: ByteArray)

object Segmenter {
  private const val TAG = "KaitechBlur"
  private const val INTERVAL_MS = 100L
  private const val SIDE = 256
  private const val MODEL = "kaitech_selfie_segmenter.tflite"
  private val worker = Executors.newSingleThreadExecutor()
  private val busy = AtomicBoolean(false)
  private val started = AtomicBoolean(false)
  private val input = ByteBuffer.allocateDirect(SIDE * SIDE * 3 * 4).order(ByteOrder.nativeOrder())
  private val output = ByteBuffer.allocateDirect(SIDE * SIDE * 4).order(ByteOrder.nativeOrder())
  private val confidence = FloatArray(SIDE * SIDE)
  private var lastAt = 0L

  @Volatile
  private var interpreter: InterpreterApi? = null

  @Volatile
  var mask: Mask? = null
    private set

  val ready: Boolean
    get() = interpreter != null

  fun prepare(context: Context) {
    if (!started.compareAndSet(false, true)) return
    val application = context.applicationContext
    TfLite.initialize(application)
      .addOnSuccessListener(worker) {
        try {
          val bytes = application.assets.open(MODEL).use { it.readBytes() }
          val model = ByteBuffer.allocateDirect(bytes.size).order(ByteOrder.nativeOrder()).put(bytes)
          model.rewind()
          interpreter = InterpreterApi.create(model, InterpreterApi.Options().setRuntime(InterpreterApi.Options.TfLiteRuntime.FROM_SYSTEM_ONLY))
        } catch (error: Throwable) {
          Log.w(TAG, "segmentation model not loaded", error)
        }
      }
      .addOnFailureListener(worker) { error -> Log.w(TAG, "TensorFlow Lite from Play services unavailable", error) }
  }

  fun offer(y: ByteArray, u: ByteArray, v: ByteArray, width: Int, height: Int, rotation: Int) {
    val model = interpreter ?: return
    val now = SystemClock.elapsedRealtime()
    if (now - lastAt < INTERVAL_MS || !busy.compareAndSet(false, true)) return
    lastAt = now
    val pixels = BackgroundBlur.uprightArgb(y, u, v, width, height, rotation, SIDE, SIDE)
    worker.execute {
      try {
        input.rewind()
        for (pixel in pixels) {
          input.putFloat(((pixel shr 16) and 0xff) / 255f)
          input.putFloat(((pixel shr 8) and 0xff) / 255f)
          input.putFloat((pixel and 0xff) / 255f)
        }
        input.rewind()
        output.rewind()
        model.run(input, output)
        output.rewind()
        output.asFloatBuffer().get(confidence)
        mask = Mask(SIDE, SIDE, rotation, width, height, BackgroundBlur.maskFrom(confidence, SIDE, SIDE))
      } catch (error: Throwable) {
        Log.w(TAG, "segmentation failed", error)
      } finally {
        busy.set(false)
      }
    }
  }

  fun clear() {
    mask = null
  }
}
