import ExpoModulesCore

public final class KaitechVideoEffectsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("KaitechVideoEffects")

    Function("blurName") {
      "kaitechBackgroundBlur"
    }

    Function("clearBlur") {}

    Function("blurAvailable") {
      true
    }

    AsyncFunction("prepareBlur") {
      true
    }
  }
}
