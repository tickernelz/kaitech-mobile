package io.kaitech.videoeffects

import android.util.Log
import io.livekit.reactnative.webrtc.videoEffects.VideoFrameProcessor
import java.nio.ByteBuffer
import java.util.concurrent.ArrayBlockingQueue
import livekit.org.webrtc.JavaI420Buffer
import livekit.org.webrtc.SurfaceTextureHelper
import livekit.org.webrtc.VideoFrame

class BlurProcessor : VideoFrameProcessor {
  private val blur = BackgroundBlur()
  private var y = ByteArray(0)
  private var u = ByteArray(0)
  private var v = ByteArray(0)
  private var outY = ByteArray(0)
  private var outU = ByteArray(0)
  private var outV = ByteArray(0)
  private var column = IntArray(0)
  private var row = IntArray(0)
  private var indexedWidth = 0
  private var indexedHeight = 0
  private var indexedRotation = -1
  private var indexedMaskWidth = 0
  private var indexedMaskHeight = 0
  private var poolWidth = 0
  private var poolHeight = 0
  private var pool = ArrayBlockingQueue<ByteBuffer>(POOL_SIZE)

  override fun process(frame: VideoFrame, textureHelper: SurfaceTextureHelper): VideoFrame {
    val i420 = frame.buffer.toI420() ?: return blackFrame(frame)
    try {
      val width = i420.width
      val height = i420.height
      val chromaWidth = (width + 1) / 2
      val chromaHeight = (height + 1) / 2
      if (y.size != width * height || u.size != chromaWidth * chromaHeight) {
        y = ByteArray(width * height)
        outY = ByteArray(width * height)
        u = ByteArray(chromaWidth * chromaHeight)
        v = ByteArray(chromaWidth * chromaHeight)
        outU = ByteArray(chromaWidth * chromaHeight)
        outV = ByteArray(chromaWidth * chromaHeight)
        column = IntArray(width)
        row = IntArray(height)
        indexedRotation = -1
      }
      read(i420.dataY, i420.strideY, width, height, y)
      read(i420.dataU, i420.strideU, chromaWidth, chromaHeight, u)
      read(i420.dataV, i420.strideV, chromaWidth, chromaHeight, v)
      var mask: Mask? = null
      try {
        Segmenter.offer(y, u, v, width, height, frame.rotation)
        mask = Segmenter.mask?.takeIf { it.rotation == frame.rotation && it.frameWidth == width && it.frameHeight == height }
        if (mask != null && (indexedWidth != width || indexedHeight != height || indexedRotation != frame.rotation || indexedMaskWidth != mask.width || indexedMaskHeight != mask.height)) {
          BackgroundBlur.maskIndex(width, height, frame.rotation, mask.width, mask.height, column, row)
          indexedWidth = width
          indexedHeight = height
          indexedRotation = frame.rotation
          indexedMaskWidth = mask.width
          indexedMaskHeight = mask.height
        }
      } catch (error: Throwable) {
        Log.w(TAG, "segmentation skipped, frame fully blurred", error)
        mask = null
      }
      val alpha = mask?.alpha
      val columns = if (mask != null) column else null
      val rows = if (mask != null) row else null
      blur.blendPlane(y, width, height, 8, 1, alpha, columns, rows, outY)
      blur.blendPlane(u, chromaWidth, chromaHeight, 4, 2, alpha, columns, rows, outU)
      blur.blendPlane(v, chromaWidth, chromaHeight, 4, 2, alpha, columns, rows, outV)
      return VideoFrame(pooledBuffer(width, height, outY, outU, outV), frame.rotation, frame.timestampNs)
    } catch (error: Throwable) {
      Log.w(TAG, "blur failed, frame sent black", error)
      return blackFrame(frame)
    } finally {
      i420.release()
    }
  }

  private fun pooledBuffer(width: Int, height: Int, planeY: ByteArray, planeU: ByteArray, planeV: ByteArray): VideoFrame.Buffer {
    val chromaWidth = (width + 1) / 2
    val chromaHeight = (height + 1) / 2
    val sizeY = width * height
    val sizeChroma = chromaWidth * chromaHeight
    if (poolWidth != width || poolHeight != height) {
      pool = ArrayBlockingQueue(POOL_SIZE)
      poolWidth = width
      poolHeight = height
    }
    val owner = pool
    val memory = owner.poll() ?: ByteBuffer.allocateDirect(sizeY + 2 * sizeChroma)
    memory.clear()
    memory.put(planeY, 0, sizeY).put(planeU, 0, sizeChroma).put(planeV, 0, sizeChroma)
    val dataY = slice(memory, 0, sizeY)
    val dataU = slice(memory, sizeY, sizeChroma)
    val dataV = slice(memory, sizeY + sizeChroma, sizeChroma)
    return JavaI420Buffer.wrap(width, height, dataY, width, dataU, chromaWidth, dataV, chromaWidth) { owner.offer(memory) }
  }

  private fun blackFrame(frame: VideoFrame): VideoFrame {
    val width = frame.buffer.width
    val height = frame.buffer.height
    val out = JavaI420Buffer.allocate(width, height)
    fill(out.dataY, out.strideY * height, 16)
    fill(out.dataU, out.strideU * ((height + 1) / 2), 128)
    fill(out.dataV, out.strideV * ((height + 1) / 2), 128)
    return VideoFrame(out, frame.rotation, frame.timestampNs)
  }

  private fun fill(target: ByteBuffer, length: Int, value: Int) {
    val view = target.duplicate()
    val count = minOf(length, view.remaining())
    for (index in 0 until count) view.put(index, value.toByte())
  }

  private fun slice(memory: ByteBuffer, offset: Int, length: Int): ByteBuffer {
    val view = memory.duplicate()
    view.position(offset)
    view.limit(offset + length)
    return view.slice()
  }

  private fun read(source: ByteBuffer, stride: Int, width: Int, height: Int, target: ByteArray) {
    val view = source.duplicate()
    for (line in 0 until height) {
      view.position(line * stride)
      view.get(target, line * width, width)
    }
  }

  private companion object {
    const val TAG = "KaitechBlur"
    const val POOL_SIZE = 4
  }
}
