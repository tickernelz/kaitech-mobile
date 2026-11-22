package io.kaitech.passkey

import androidx.credentials.CreatePublicKeyCredentialRequest
import androidx.credentials.CreatePublicKeyCredentialResponse
import androidx.credentials.CredentialManager
import androidx.credentials.exceptions.CreateCredentialCancellationException
import androidx.credentials.exceptions.CreateCredentialException
import androidx.credentials.exceptions.CreateCredentialNoCreateOptionException
import androidx.credentials.exceptions.CreateCredentialProviderConfigurationException
import androidx.credentials.exceptions.CreateCredentialUnsupportedException
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class PasskeyException(code: String, message: String?) : CodedException(code, message ?: code, null)

class KaitechPasskeyModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("KaitechPasskey")

    AsyncFunction("create") Coroutine { requestJson: String ->
      val activity = appContext.currentActivity ?: throw Exceptions.MissingActivity()
      try {
        val response = withContext(Dispatchers.Main) {
          CredentialManager.create(activity).createCredential(activity, CreatePublicKeyCredentialRequest(requestJson))
        }
        (response as? CreatePublicKeyCredentialResponse)?.registrationResponseJson
          ?: throw PasskeyException("ERR_PASSKEY_FAILED", "unexpected credential type " + response.type)
      } catch (error: CreateCredentialCancellationException) {
        throw PasskeyException("ERR_PASSKEY_CANCELLED", error.message)
      } catch (error: CreateCredentialNoCreateOptionException) {
        throw PasskeyException("ERR_PASSKEY_NO_PROVIDER", error.message)
      } catch (error: CreateCredentialProviderConfigurationException) {
        throw PasskeyException("ERR_PASSKEY_NO_PROVIDER", error.message)
      } catch (error: CreateCredentialUnsupportedException) {
        throw PasskeyException("ERR_PASSKEY_NO_PROVIDER", error.message)
      } catch (error: CreateCredentialException) {
        throw PasskeyException("ERR_PASSKEY_FAILED", error.type + ": " + error.message)
      }
    }
  }
}
