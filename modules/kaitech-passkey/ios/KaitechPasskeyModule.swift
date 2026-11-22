import AuthenticationServices
import ExpoModulesCore

final class PasskeyException: GenericException<(code: String, message: String)> {
  override var code: String { param.code }
  override var reason: String { param.message }
}

private func base64url(_ data: Data) -> String {
  data.base64EncodedString().replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
}

private func bytes(_ text: String?) -> Data? {
  guard var value = text?.replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/") else { return nil }
  while value.count % 4 != 0 { value += "=" }
  return Data(base64Encoded: value)
}

private final class Registration: NSObject, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
  let promise: Promise
  var keep: Registration?

  init(promise: Promise) {
    self.promise = promise
  }

  func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
    UIApplication.shared.connectedScenes.compactMap { ($0 as? UIWindowScene)?.keyWindow }.first ?? ASPresentationAnchor()
  }

  func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
    defer { keep = nil }
    guard let credential = authorization.credential as? ASAuthorizationPlatformPublicKeyCredentialRegistration,
          let attestation = credential.rawAttestationObject else {
      promise.reject(PasskeyException((code: "ERR_PASSKEY_FAILED", message: "unexpected credential")))
      return
    }
    let id = base64url(credential.credentialID)
    let answer: [String: Any] = [
      "id": id,
      "rawId": id,
      "type": "public-key",
      "authenticatorAttachment": "platform",
      "clientExtensionResults": [String: Any](),
      "response": [
        "clientDataJSON": base64url(credential.rawClientDataJSON),
        "attestationObject": base64url(attestation),
        "transports": ["internal", "hybrid"],
      ],
    ]
    guard let data = try? JSONSerialization.data(withJSONObject: answer), let text = String(data: data, encoding: .utf8) else {
      promise.reject(PasskeyException((code: "ERR_PASSKEY_FAILED", message: "unreadable credential")))
      return
    }
    promise.resolve(text)
  }

  func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
    defer { keep = nil }
    let failure = error as? ASAuthorizationError
    let code = failure?.code == .canceled ? "ERR_PASSKEY_CANCELLED" : "ERR_PASSKEY_FAILED"
    promise.reject(PasskeyException((code: code, message: error.localizedDescription)))
  }
}

public final class KaitechPasskeyModule: Module {
  public func definition() -> ModuleDefinition {
    Name("KaitechPasskey")

    AsyncFunction("create") { (requestJson: String, promise: Promise) in
      guard let data = requestJson.data(using: .utf8),
            let options = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            let rp = options["rp"] as? [String: Any], let rpId = rp["id"] as? String,
            let user = options["user"] as? [String: Any], let name = user["name"] as? String,
            let userId = bytes(user["id"] as? String), let challenge = bytes(options["challenge"] as? String) else {
        promise.reject(PasskeyException((code: "ERR_PASSKEY_FAILED", message: "unreadable creation options")))
        return
      }
      let request = ASAuthorizationPlatformPublicKeyCredentialProvider(relyingPartyIdentifier: rpId)
        .createCredentialRegistrationRequest(challenge: challenge, name: name, userID: userId)
      request.userVerificationPreference = .required
      let excluded = (options["excludeCredentials"] as? [[String: Any]] ?? []).compactMap { bytes($0["id"] as? String) }
      if #available(iOS 17.4, *) {
        request.excludedCredentials = excluded.map { ASAuthorizationPlatformPublicKeyCredentialDescriptor(credentialID: $0) }
      }
      let registration = Registration(promise: promise)
      registration.keep = registration
      let controller = ASAuthorizationController(authorizationRequests: [request])
      controller.delegate = registration
      controller.presentationContextProvider = registration
      controller.performRequests()
    }.runOnQueue(.main)
  }
}
