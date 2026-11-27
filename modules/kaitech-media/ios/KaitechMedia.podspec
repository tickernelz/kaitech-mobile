Pod::Spec.new do |s|
  s.name           = 'KaitechMedia'
  s.version        = '0.1.0'
  s.summary        = 'PDF page and video frame previews for Kaitech chat'
  s.description    = 'Renders PDF pages with PDFKit and reads a video frame and duration with AVFoundation.'
  s.author         = 'Kaitech'
  s.homepage       = 'https://github.com/tickernelz/kaitech-mobile'
  s.license        = 'MIT'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks     = 'PDFKit', 'AVFoundation', 'UIKit'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = '**/*.swift'
end
