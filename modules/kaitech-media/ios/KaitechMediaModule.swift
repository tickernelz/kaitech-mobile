import AVFoundation
import ExpoModulesCore
import PDFKit
import UIKit

final class PdfUnreadableException: Exception, @unchecked Sendable {
  override var reason: String { "The PDF cannot be read" }
}

final class VideoUnreadableException: Exception, @unchecked Sendable {
  override var reason: String { "The video frame cannot be read" }
}

public final class KaitechMediaModule: Module {
  public func definition() -> ModuleDefinition {
    Name("KaitechMedia")

    AsyncFunction("renderPdfPage") { (source: URL, page: Int, width: Int, target: URL) throws -> [String: Int] in
      guard let document = PDFDocument(url: source), !document.isLocked, document.pageCount > 0,
        let opened = document.page(at: min(max(page, 0), document.pageCount - 1))
      else { throw PdfUnreadableException() }
      let bounds = opened.bounds(for: .mediaBox)
      let turned = opened.rotation % 180 != 0
      let pageWidth = turned ? bounds.height : bounds.width
      let pageHeight = turned ? bounds.width : bounds.height
      guard pageWidth > 0, pageHeight > 0 else { throw PdfUnreadableException() }
      let outWidth = min(max(width, 64), 2048)
      let outHeight = min(max(Int(Double(outWidth) * Double(pageHeight / pageWidth)), 1), 4096)
      let image = opened.thumbnail(of: CGSize(width: outWidth, height: outHeight), for: .mediaBox)
      try writeJpeg(image, to: target)
      return ["width": outWidth, "height": outHeight, "pages": document.pageCount]
    }

    AsyncFunction("videoFrame") { (source: URL, headers: [String: String], width: Int, target: URL) async throws -> [String: Int] in
      let asset = AVURLAsset(url: source, options: source.isFileURL ? nil : ["AVURLAssetHTTPHeaderFieldsKey": headers])
      let generator = AVAssetImageGenerator(asset: asset)
      generator.appliesPreferredTrackTransform = true
      let side = CGFloat(min(max(width, 64), 2048))
      generator.maximumSize = CGSize(width: side, height: side)
      do {
        let duration = try await asset.load(.duration)
        let seconds = duration.seconds.isFinite ? max(duration.seconds, 0) : 0
        let (frame, _) = try await generator.image(at: CMTime(seconds: min(1, seconds / 2), preferredTimescale: 600))
        try writeJpeg(UIImage(cgImage: frame), to: target)
        return ["width": frame.width, "height": frame.height, "durationMs": Int(seconds * 1000)]
      } catch {
        throw VideoUnreadableException()
      }
    }
  }
}

private func writeJpeg(_ image: UIImage, to target: URL) throws {
  guard let data = image.jpegData(compressionQuality: 0.85) else { throw PdfUnreadableException() }
  try FileManager.default.createDirectory(at: target.deletingLastPathComponent(), withIntermediateDirectories: true)
  try data.write(to: target, options: .atomic)
}
