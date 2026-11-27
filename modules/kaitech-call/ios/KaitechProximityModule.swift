import AVFoundation
import ExpoModulesCore
import UIKit

public class KaitechProximityModule: Module {
  private var routeObserver: NSObjectProtocol?

  public func definition() -> ModuleDefinition {
    Name("KaitechProximity")

    Events("onAudioRouteChange")

    Function("audioRoute") { () -> String in
      Self.route()
    }

    AsyncFunction("setScreenOff") { (enabled: Bool) -> Bool in
      UIDevice.current.isProximityMonitoringEnabled = enabled
      return UIDevice.current.isProximityMonitoringEnabled
    }.runOnQueue(.main)

    OnStartObserving {
      self.watchRoute(true)
    }

    OnStopObserving {
      self.watchRoute(false)
    }

    OnDestroy {
      self.watchRoute(false)
      DispatchQueue.main.async {
        UIDevice.current.isProximityMonitoringEnabled = false
      }
    }
  }

  private func watchRoute(_ on: Bool) {
    if let routeObserver {
      NotificationCenter.default.removeObserver(routeObserver)
      self.routeObserver = nil
    }
    guard on else { return }
    routeObserver = NotificationCenter.default.addObserver(forName: AVAudioSession.routeChangeNotification, object: nil, queue: .main) { [weak self] _ in
      self?.sendEvent("onAudioRouteChange", [:])
    }
  }

  static func route() -> String {
    guard let port = AVAudioSession.sharedInstance().currentRoute.outputs.first?.portType else { return "unknown" }
    switch port {
    case .builtInReceiver: return "earpiece"
    case .builtInSpeaker: return "speaker"
    case .bluetoothHFP, .bluetoothA2DP, .bluetoothLE: return "bluetooth"
    case .headphones, .usbAudio: return "headset"
    default: return "other"
    }
  }
}
