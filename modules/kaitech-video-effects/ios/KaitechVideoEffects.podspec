Pod::Spec.new do |s|
  s.name           = 'KaitechVideoEffects'
  s.version        = '0.1.0'
  s.summary        = 'Background blur for the local camera in Kaitech calls'
  s.description    = 'Registers a LiveKit WebRTC video frame processor that blurs everything except the person, using Vision person segmentation.'
  s.author         = 'Kaitech'
  s.homepage       = 'https://github.com/tickernelz/kaitech-mobile'
  s.license        = 'MIT'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.dependency 'livekit-react-native-webrtc'
  s.frameworks     = 'Vision', 'CoreImage'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = '**/*.{swift,m}'
end
