package io.kaitech.videoeffects

import android.util.Log
import io.livekit.reactnative.webrtc.videoEffects.VideoFrameProcessor
import java.nio.ByteBuffer
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
  private var indexed: List<Int> = emptyList()

  override fun process(frame: VideoFrame, textureHelper: SurfaceTextureHelper): VideoFrame {
    val i420 = frame.buffer.toI420() ?: return frame.also { it.retain() }
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
        indexed = emptyList()
      }
      read(i420.dataY, i420.strideY, width, height, y)
      read(i420.dataU, i420.strideU, chromaWidth, chromaHeight, u)
      read(i420.dataV, i420.strideV, chromaWidth, chromaHeight, v)
      Segmenter.offer(y, u, v, width, height, frame.rotation)
      val mask = Segmenter.mask?.takeIf { it.rotation == frame.rotation && it.frameWidth == width && it.frameHeight == height }
      if (mask != null) {
        val key = listOf(width, height, frame.rotation, mask.width, mask.height)
        if (key != indexed) {
          BackgroundBlur.maskIndex(width, height, frame.rotation, mask.width, mask.height, column, row)
          indexed = key
        }
      }
      val alpha = mask?.alpha
      val columns = if (mask != null) column else null
      val rows = if (mask != null) row else null
      blur.blendPlane(y, width, height, 8, 1, alpha, columns, rows, outY)
      blur.blendPlane(u, chromaWidth, chromaHeight, 4, 2, alpha, columns, rows, outU)
      blur.blendPlane(v, chromaWidth, chromaHeight, 4, 2, alpha, columns, rows, outV)
      val out = JavaI420Buffer.allocate(width, height)
      write(outY, width, height, out.dataY, out.strideY)
      write(outU, chromaWidth, chromaHeight, out.dataU, out.strideU)
      write(outV, chromaWidth, chromaHeight, out.dataV, out.strideV)
      return VideoFrame(out, frame.rotation, frame.timestampNs)
    } catch (error: Throwable) {
      Log.w("KaitechBlur", "frame left unblurred", error)
      frame.retain()
      return frame
    } finally {
      i420.release()
    }
  }

  private fun read(source: ByteBuffer, stride: Int, width: Int, height: Int, target: ByteArray) {
    val view = source.duplicate()
    for (line in 0 until height) {
      view.position(line * stride)
      view.get(target, line * width, width)
    }
  }

  private fun write(source: ByteArray, width: Int, height: Int, target: ByteBuffer, stride: Int) {
    val view = target.duplicate()
    for (line in 0 until height) {
      view.position(line * stride)
      view.put(source, line * width, width)
    }
  }
}
