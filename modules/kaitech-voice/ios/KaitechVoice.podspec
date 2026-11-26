Pod::Spec.new do |s|
  s.name           = 'KaitechVoice'
  s.version        = '0.1.0'
  s.summary        = 'Voice note segments for the Kaitech app'
  s.description    = 'Joins recorded AAC voice note segments into one m4a file.'
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
