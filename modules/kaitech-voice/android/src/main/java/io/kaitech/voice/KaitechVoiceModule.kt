package io.kaitech.voice

import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMuxer
import android.net.Uri
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.nio.ByteBuffer

class VoiceJoinException(message: String?) : CodedException("ERR_VOICE_JOIN", message ?: "voice join failed", null)

private fun pathOf(uri: String): String = if (uri.startsWith("file:")) Uri.parse(uri).path ?: uri else uri

private fun join(parts: List<String>, target: String): Long {
  if (parts.isEmpty()) throw VoiceJoinException("no parts")
  File(target).delete()
  val muxer = MediaMuxer(target, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
  val buffer = ByteBuffer.allocate(1 shl 20)
  val info = MediaCodec.BufferInfo()
  var track = -1
  var offsetUs = 0L
  try {
    for (part in parts) {
      val extractor = MediaExtractor()
      try {
        extractor.setDataSource(part)
        val index = (0 until extractor.trackCount).firstOrNull { extractor.getTrackFormat(it).getString(MediaFormat.KEY_MIME)?.startsWith("audio/") == true }
          ?: throw VoiceJoinException("no audio track in $part")
        val format = extractor.getTrackFormat(index)
        extractor.selectTrack(index)
        if (track < 0) {
          track = muxer.addTrack(format)
          muxer.start()
        }
        val sampleRate = if (format.containsKey(MediaFormat.KEY_SAMPLE_RATE)) format.getInteger(MediaFormat.KEY_SAMPLE_RATE) else 44100
        val frameUs = 1024L * 1_000_000L / sampleRate
        var lastUs = -frameUs
        while (true) {
          val size = extractor.readSampleData(buffer, 0)
          if (size < 0) break
          val sync = extractor.sampleFlags and MediaExtractor.SAMPLE_FLAG_SYNC != 0
          info.set(0, size, offsetUs + extractor.sampleTime, if (sync) MediaCodec.BUFFER_FLAG_KEY_FRAME else 0)
          muxer.writeSampleData(track, buffer, info)
          lastUs = extractor.sampleTime
          extractor.advance()
        }
        offsetUs += lastUs + frameUs
      } finally {
        extractor.release()
      }
    }
    muxer.stop()
  } catch (error: Exception) {
    File(target).delete()
    if (error is VoiceJoinException) throw error
    throw VoiceJoinException(error.message)
  } finally {
    muxer.release()
  }
  return offsetUs / 1000
}

class KaitechVoiceModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("KaitechVoice")

    AsyncFunction("join") Coroutine { parts: List<String>, target: String ->
      withContext(Dispatchers.IO) {
        val durationMs = join(parts.map(::pathOf), pathOf(target))
        mapOf("uri" to target, "durationMs" to durationMs)
      }
    }
  }
}
