package com.millionaireapp.audio

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * Exposes [SoundModule] to JS.
 *
 * This is a plain (legacy) [ReactPackage], the same shape autolinked libraries
 * such as op-sqlite use; React Native bridges it into the new architecture
 * through the TurboModule interop layer.
 */
class SoundPackage : ReactPackage {

  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
      listOf(SoundModule(reactContext))

  override fun createViewManagers(
      reactContext: ReactApplicationContext
  ): List<ViewManager<*, *>> = emptyList()
}
