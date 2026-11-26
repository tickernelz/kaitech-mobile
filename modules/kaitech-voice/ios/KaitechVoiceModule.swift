import AVFoundation
import ExpoModulesCore

final class VoiceJoinException: GenericException<String> {
  override var code: String { "ERR_VOICE_JOIN" }
  override var reason: String { param }
}

public class KaitechVoiceModule: Module {
  public func definition() -> ModuleDefinition {
    Name("KaitechVoice")

    AsyncFunction("join") { (parts: [String], target: String, promise: Promise) in
      guard !parts.isEmpty, let output = URL(string: target) else {
        promise.reject(VoiceJoinException("no parts"))
        return
      }
      let composition = AVMutableComposition()
      guard let track = composition.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid) else {
        promise.reject(VoiceJoinException("no audio track"))
        return
      }
      var cursor = CMTime.zero
      do {
        for part in parts {
          guard let url = URL(string: part) else { throw VoiceJoinException("bad uri \(part)") }
          let asset = AVURLAsset(url: url)
          guard let source = asset.tracks(withMediaType: .audio).first else { throw VoiceJoinException("no audio in \(part)") }
          try track.insertTimeRange(CMTimeRange(start: .zero, duration: asset.duration), of: source, at: cursor)
          cursor = CMTimeAdd(cursor, asset.duration)
        }
      } catch {
        promise.reject(VoiceJoinException(error.localizedDescription))
        return
      }
      try? FileManager.default.removeItem(at: output)
      guard let export = AVAssetExportSession(asset: composition, presetName: AVAssetExportPresetAppleM4A) else {
        promise.reject(VoiceJoinException("no export session"))
        return
      }
      export.outputURL = output
      export.outputFileType = .m4a
      let durationMs = Int(CMTimeGetSeconds(cursor) * 1000)
      export.exportAsynchronously {
        if export.status == .completed {
          promise.resolve(["uri": target, "durationMs": durationMs])
        } else {
          promise.reject(VoiceJoinException(export.error?.localizedDescription ?? "export failed"))
        }
      }
    }
  }
}
