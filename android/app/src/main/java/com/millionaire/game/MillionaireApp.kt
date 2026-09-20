package com.millionaire.game

import android.app.Application
import com.millionaire.game.audio.SoundManager

/**
 * Registers the app-wide audio engine so music and sound effects work across every
 * screen. Kept deliberately small — anything heavier belongs in a repository.
 */
class MillionaireApp : Application() {

    override fun onCreate() {
        super.onCreate()
        SoundManager.init(this)
    }
}
