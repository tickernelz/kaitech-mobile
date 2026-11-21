Pod::Spec.new do |s|
  s.name           = 'KaitechCall'
  s.version        = '0.1.0'
  s.summary        = 'Screen broadcast events for Kaitech calls'
  s.description    = 'Tells the app when the Kaitech broadcast upload extension starts or stops sharing the screen.'
  s.author         = 'Kaitech'
  s.homepage       = 'https://github.com/tickernelz/kaitech-mobile'
  s.license        = 'MIT'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = '**/*.swift'
end
