package com.millionaire.game.data.sync

import android.content.Context
import android.util.Log
import androidx.work.*
import com.millionaire.game.data.repository.GameRepository
import com.millionaire.game.util.SessionManager
import java.util.concurrent.TimeUnit

/**
 * Background worker that pushes any unsynced game sessions to the server.
 *
 * Runs periodically (every 15 minutes) but only when connectivity is available, so it
 * quietly drains the offline queue once the device comes back online without the user
 * having to open the game.
 */
class SyncWorker(
    appContext: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(appContext, workerParams) {

    override suspend fun doWork(): Result {
        Log.d(TAG, "SyncWorker running — pushing pending game sessions")
        return try {
            val repository = GameRepository(applicationContext)
            val token = SessionManager(applicationContext).getToken()
            val success = repository.syncGameSessions(token)
            if (success) {
                Log.d(TAG, "SyncWorker finished — all sessions synced")
                Result.success()
            } else {
                Log.w(TAG, "SyncWorker finished — some sessions still pending, will retry")
                Result.retry()
            }
        } catch (e: Exception) {
            Log.e(TAG, "SyncWorker error", e)
            Result.retry()
        }
    }

    companion object {
        private const val TAG = "SyncWorker"
        private const val UNIQUE_WORK_NAME = "millionaire_sync_worker"

        /**
         * Enqueues the periodic background sync. Safe to call repeatedly — WorkManager
         * keeps a single unique instance.
         */
        fun schedule(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            val request = PeriodicWorkRequestBuilder<SyncWorker>(15, TimeUnit.MINUTES)
                .setConstraints(constraints)
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 1, TimeUnit.MINUTES)
                .build()

            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                UNIQUE_WORK_NAME,
                ExistingPeriodicWorkPolicy.KEEP,
                request
            )
        }

        /**
         * Requests an immediate one-shot sync (e.g. when the app comes to the foreground
         * and there are pending sessions).
         */
        fun syncNow(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            val request = OneTimeWorkRequestBuilder<SyncWorker>()
                .setConstraints(constraints)
                .build()

            WorkManager.getInstance(context).enqueue(request)
        }
    }
}
