import ExpoModulesCore

public class KaitechBroadcastModule: Module {
  static let started = "io.kaitech.broadcast.started"
  static let stopped = "io.kaitech.broadcast.stopped"

  private var observing = false

  public func definition() -> ModuleDefinition {
    Name("KaitechBroadcast")

    Events("onBroadcast")

    Function("available") { () -> Bool in
      let info = Bundle.main.infoDictionary
      guard let group = info?["RTCAppGroupIdentifier"] as? String, info?["RTCScreenSharingExtension"] is String else { return false }
      return FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group) != nil
    }

    OnStartObserving {
      self.observe(true)
    }

    OnStopObserving {
      self.observe(false)
    }

    OnDestroy {
      self.observe(false)
    }
  }

  private func observe(_ on: Bool) {
    guard on != observing else { return }
    observing = on
    let center = CFNotificationCenterGetDarwinNotifyCenter()
    let observer = Unmanaged.passUnretained(self).toOpaque()
    guard on else {
      CFNotificationCenterRemoveEveryObserver(center, observer)
      return
    }
    for name in [Self.started, Self.stopped] {
      CFNotificationCenterAddObserver(center, observer, { _, observer, name, _, _ in
        guard let observer, let name else { return }
        let module = Unmanaged<KaitechBroadcastModule>.fromOpaque(observer).takeUnretainedValue()
        let state = (name.rawValue as String) == KaitechBroadcastModule.started ? "started" : "stopped"
        module.sendEvent("onBroadcast", ["state": state])
      }, name as CFString, nil, .deliverImmediately)
    }
  }
}
