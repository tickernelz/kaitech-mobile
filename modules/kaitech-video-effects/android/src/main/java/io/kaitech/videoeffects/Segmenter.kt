package io.kaitech.videoeffects

import android.graphics.Bitmap
import android.os.SystemClock
import android.util.Log
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.segmentation.Segmentation
import com.google.mlkit.vision.segmentation.selfie.SelfieSegmenterOptions
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

class Mask(val width: Int, val height: Int, val rotation: Int, val frameWidth: Int, val frameHeight: Int, val alpha: ByteArray)

object Segmenter {
  private const val TAG = "KaitechBlur"
  private const val INTERVAL_MS = 100L
  private val client by lazy {
    Segmentation.getClient(SelfieSegmenterOptions.Builder().setDetectorMode(SelfieSegmenterOptions.STREAM_MODE).build())
  }
  private val worker = Executors.newSingleThreadExecutor()
  private val busy = AtomicBoolean(false)
  private var lastAt = 0L

  @Volatile
  var mask: Mask? = null
    private set

  fun offer(y: ByteArray, u: ByteArray, v: ByteArray, width: Int, height: Int, rotation: Int) {
    val now = SystemClock.elapsedRealtime()
    if (now - lastAt < INTERVAL_MS || !busy.compareAndSet(false, true)) return
    lastAt = now
    val size = BackgroundBlur.segmentSize(width, height, rotation)
    val pixels = BackgroundBlur.uprightArgb(y, u, v, width, height, rotation, size[0], size[1])
    worker.execute {
      try {
        val bitmap = Bitmap.createBitmap(pixels, size[0], size[1], Bitmap.Config.ARGB_8888)
        client.process(InputImage.fromBitmap(bitmap, 0))
          .addOnSuccessListener(worker) { result ->
            val confidence = FloatArray(result.width * result.height)
            result.buffer.rewind()
            result.buffer.asFloatBuffer().get(confidence)
            mask = Mask(result.width, result.height, rotation, width, height, BackgroundBlur.maskFrom(confidence, result.width, result.height))
          }
          .addOnFailureListener(worker) { error -> Log.w(TAG, "segmentation failed", error) }
          .addOnCompleteListener(worker) { busy.set(false) }
      } catch (error: Throwable) {
        Log.w(TAG, "segmentation not started", error)
        busy.set(false)
      }
    }
  }

  fun clear() {
    mask = null
  }
}
