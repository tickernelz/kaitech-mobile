import CoreImage
import Foundation
import ReplayKit

private let startedName = "io.kaitech.broadcast.started"
private let stoppedName = "io.kaitech.broadcast.stopped"
private let socketName = "rtc_SSFD"
private let chunkLength = 10240

private func postDarwin(_ name: String) {
  CFNotificationCenterPostNotification(CFNotificationCenterGetDarwinNotifyCenter(), CFNotificationName(name as CFString), nil, nil, true)
}

final class SocketConnection: NSObject, StreamDelegate {
  var didOpen: (() -> Void)?
  var didClose: ((Error?) -> Void)?
  var hasSpace: (() -> Void)?

  private let path: String
  private let handle: Int32
  private var input: InputStream?
  private var output: OutputStream?
  private var running = false
  private var queue: DispatchQueue?

  init?(path: String) {
    self.path = path
    handle = Darwin.socket(AF_UNIX, SOCK_STREAM, 0)
    guard handle != -1 else { return nil }
  }

  func open() -> Bool {
    guard FileManager.default.fileExists(atPath: path) else { return false }
    var address = sockaddr_un()
    let capacity = MemoryLayout.size(ofValue: address.sun_path)
    guard path.utf8.count < capacity else { return false }
    withUnsafeMutablePointer(to: &address.sun_path) { pointer in
      pointer.withMemoryRebound(to: CChar.self, capacity: capacity) { target in
        _ = path.withCString { strncpy(target, $0, capacity - 1) }
      }
    }
    address.sun_family = sa_family_t(AF_UNIX)
    let status = withUnsafePointer(to: &address) { pointer in
      pointer.withMemoryRebound(to: sockaddr.self, capacity: 1) {
        Darwin.connect(handle, $0, socklen_t(MemoryLayout<sockaddr_un>.size))
      }
    }
    guard status == 0 else { return false }
    var read: Unmanaged<CFReadStream>?
    var write: Unmanaged<CFWriteStream>?
    CFStreamCreatePairWithSocket(kCFAllocatorDefault, handle, &read, &write)
    input = read?.takeRetainedValue()
    output = write?.takeRetainedValue()
    for stream in [input as Stream?, output as Stream?] {
      stream?.delegate = self
      stream?.setProperty(kCFBooleanTrue, forKey: Stream.PropertyKey(kCFStreamPropertyShouldCloseNativeSocket as String))
    }
    running = true
    let queue = DispatchQueue.global(qos: .userInitiated)
    self.queue = queue
    queue.async { [weak self] in
      self?.input?.schedule(in: .current, forMode: .common)
      self?.output?.schedule(in: .current, forMode: .common)
      while self?.running == true && RunLoop.current.run(mode: .default, before: .distantFuture) {}
    }
    input?.open()
    output?.open()
    return true
  }

  func close() {
    running = false
    for stream in [input as Stream?, output as Stream?] {
      stream?.delegate = nil
      stream?.close()
    }
    input = nil
    output = nil
  }

  func write(_ buffer: UnsafePointer<UInt8>, length: Int) -> Int {
    output?.write(buffer, maxLength: length) ?? 0
  }

  func stream(_ stream: Stream, handle event: Stream.Event) {
    switch event {
    case .openCompleted:
      if stream == output { didOpen?() }
    case .hasBytesAvailable:
      guard stream == input else { return }
      var byte: UInt8 = 0
      if input?.read(&byte, maxLength: 1) == 0 && stream.streamStatus == .atEnd {
        close()
        didClose?(nil)
      }
    case .hasSpaceAvailable:
      if stream == output { hasSpace?() }
    case .errorOccurred:
      close()
      didClose?(stream.streamError)
    default:
      break
    }
  }
}

final class SampleUploader {
  private static let context = CIContext(options: nil)
  private let connection: SocketConnection
  private let queue = DispatchQueue(label: "io.kaitech.broadcast.uploader")
  private let lock = NSLock()
  private var ready = false
  private var pending: Data?
  private var offset = 0

  init(connection: SocketConnection) {
    self.connection = connection
    connection.didOpen = { [weak self] in self?.setReady(true) }
    connection.hasSpace = { [weak self] in
      self?.queue.async {
        guard let self else { return }
        self.setReady(!self.sendChunk())
      }
    }
  }

  func send(_ buffer: CMSampleBuffer) {
    lock.lock()
    guard ready else {
      lock.unlock()
      return
    }
    ready = false
    lock.unlock()
    queue.async { [weak self] in
      guard let self else { return }
      self.pending = Self.frame(from: buffer)
      self.offset = 0
      self.sendChunk()
    }
  }

  private func setReady(_ value: Bool) {
    lock.lock()
    ready = value
    lock.unlock()
  }

  @discardableResult private func sendChunk() -> Bool {
    guard let data = pending else { return false }
    let length = min(chunkLength, data.count - offset)
    let written = data[offset..<(offset + length)].withUnsafeBytes { raw -> Int in
      guard let base = raw.bindMemory(to: UInt8.self).baseAddress else { return 0 }
      return connection.write(base, length: length)
    }
    if written > 0 {
      offset += written
      if offset >= data.count {
        pending = nil
        offset = 0
      }
    }
    return true
  }

  private static func frame(from buffer: CMSampleBuffer) -> Data? {
    guard let image = CMSampleBufferGetImageBuffer(buffer) else { return nil }
    CVPixelBufferLockBaseAddress(image, .readOnly)
    defer { CVPixelBufferUnlockBaseAddress(image, .readOnly) }
    let scale = 2
    let width = CVPixelBufferGetWidth(image) / scale
    let height = CVPixelBufferGetHeight(image) / scale
    let orientation = CMGetAttachment(buffer, key: RPVideoSampleOrientationKey as CFString, attachmentModeOut: nil)?.uintValue ?? 0
    let scaled = CIImage(cvPixelBuffer: image).transformed(by: CGAffineTransform(scaleX: 1 / CGFloat(scale), y: 1 / CGFloat(scale)))
    guard let space = scaled.colorSpace,
          let jpeg = context.jpegRepresentation(of: scaled, colorSpace: space, options: [kCGImageDestinationLossyCompressionQuality as CIImageRepresentationOption: 1.0])
    else { return nil }
    let message = CFHTTPMessageCreateResponse(nil, 200, nil, kCFHTTPVersion1_1).takeRetainedValue()
    CFHTTPMessageSetHeaderFieldValue(message, "Content-Length" as CFString, String(jpeg.count) as CFString)
    CFHTTPMessageSetHeaderFieldValue(message, "Buffer-Width" as CFString, String(width) as CFString)
    CFHTTPMessageSetHeaderFieldValue(message, "Buffer-Height" as CFString, String(height) as CFString)
    CFHTTPMessageSetHeaderFieldValue(message, "Buffer-Orientation" as CFString, String(orientation) as CFString)
    CFHTTPMessageSetBody(message, jpeg as CFData)
    return CFHTTPMessageCopySerializedMessage(message)?.takeRetainedValue() as Data?
  }
}

class SampleHandler: RPBroadcastSampleHandler {
  private var connection: SocketConnection?
  private var uploader: SampleUploader?
  private var frames = 0

  override init() {
    super.init()
    let group = Bundle.main.object(forInfoDictionaryKey: "RTCAppGroupIdentifier") as? String ?? ""
    let path = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group)?.appendingPathComponent(socketName).path ?? ""
    guard let connection = SocketConnection(path: path) else { return }
    self.connection = connection
    uploader = SampleUploader(connection: connection)
    connection.didClose = { [weak self] error in
      let reason = error ?? NSError(domain: RPRecordingErrorDomain, code: 10001, userInfo: [NSLocalizedDescriptionKey: "Screen sharing stopped"])
      self?.finishBroadcastWithError(reason)
    }
  }

  override func broadcastStarted(withSetupInfo setupInfo: [String: NSObject]?) {
    frames = 0
    postDarwin(startedName)
    let timer = DispatchSource.makeTimerSource(queue: DispatchQueue(label: "io.kaitech.broadcast.connect"))
    timer.schedule(deadline: .now(), repeating: .milliseconds(100), leeway: .milliseconds(500))
    timer.setEventHandler { [weak self] in
      guard self?.connection?.open() == true else { return }
      timer.cancel()
    }
    timer.resume()
  }

  override func broadcastFinished() {
    postDarwin(stoppedName)
    connection?.close()
  }

  override func processSampleBuffer(_ sampleBuffer: CMSampleBuffer, with sampleBufferType: RPSampleBufferType) {
    guard sampleBufferType == .video else { return }
    frames += 1
    if frames % 3 == 0 { uploader?.send(sampleBuffer) }
  }
}
