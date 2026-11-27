package io.kaitech.media

import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Build
import android.os.ParcelFileDescriptor
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileOutputStream

class PdfUnreadableException(cause: Throwable?) : CodedException("ERR_PDF_UNREADABLE", "The PDF cannot be read", cause)

class VideoUnreadableException(cause: Throwable?) : CodedException("ERR_VIDEO_UNREADABLE", "The video frame cannot be read", cause)

class KaitechMediaModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("KaitechMedia")

    AsyncFunction("renderPdfPage") { source: String, page: Int, width: Int, target: String ->
      renderPdfPage(source, page, width, target)
    }

    AsyncFunction("videoFrame") { source: String, headers: Map<String, String>, width: Int, target: String ->
      videoFrame(source, headers, width, target)
    }
  }
}

private fun pathOf(uri: String): String = if (uri.startsWith("file:")) Uri.parse(uri).path ?: uri else uri

private fun writeJpeg(bitmap: Bitmap, target: String) {
  val file = File(pathOf(target))
  file.parentFile?.mkdirs()
  FileOutputStream(file).use { bitmap.compress(Bitmap.CompressFormat.JPEG, 85, it) }
}

private fun renderPdfPage(source: String, page: Int, width: Int, target: String): Map<String, Int> =
  try {
    ParcelFileDescriptor.open(File(pathOf(source)), ParcelFileDescriptor.MODE_READ_ONLY).use { descriptor ->
      PdfRenderer(descriptor).use { renderer ->
        val pages = renderer.pageCount
        renderer.openPage(page.coerceIn(0, pages - 1)).use { opened ->
          val outWidth = width.coerceIn(64, 2048)
          val outHeight = (outWidth.toLong() * opened.height / opened.width).toInt().coerceIn(1, 4096)
          val bitmap = Bitmap.createBitmap(outWidth, outHeight, Bitmap.Config.ARGB_8888)
          try {
            bitmap.eraseColor(Color.WHITE)
            opened.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
            writeJpeg(bitmap, target)
          } finally {
            bitmap.recycle()
          }
          mapOf("width" to outWidth, "height" to outHeight, "pages" to pages)
        }
      }
    }
  } catch (error: Exception) {
    throw PdfUnreadableException(error)
  }

private fun videoFrame(source: String, headers: Map<String, String>, width: Int, target: String): Map<String, Long> {
  val retriever = MediaMetadataRetriever()
  try {
    if (source.startsWith("http://") || source.startsWith("https://")) retriever.setDataSource(source, headers) else retriever.setDataSource(pathOf(source))
    val durationMs = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull() ?: 0L
    val atUs = minOf(1_000_000L, durationMs * 500L)
    val side = width.coerceIn(64, 2048)
    val frame = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      retriever.getScaledFrameAtTime(atUs, MediaMetadataRetriever.OPTION_CLOSEST_SYNC, side, side)
    } else {
      retriever.getFrameAtTime(atUs, MediaMetadataRetriever.OPTION_CLOSEST_SYNC)
    } ?: throw IllegalStateException("no frame")
    try {
      writeJpeg(frame, target)
      return mapOf("width" to frame.width.toLong(), "height" to frame.height.toLong(), "durationMs" to durationMs)
    } finally {
      frame.recycle()
    }
  } catch (error: Exception) {
    throw VideoUnreadableException(error)
  } finally {
    try {
      retriever.release()
    } catch (_: Exception) {
    }
  }
}
