Pod::Spec.new do |s|
  s.name           = 'KaitechPasskey'
  s.version        = '0.1.0'
  s.summary        = 'Passkey creation for the Kaitech app'
  s.description    = 'Creates a platform passkey from WebAuthn creation options and answers the registration as WebAuthn JSON.'
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
