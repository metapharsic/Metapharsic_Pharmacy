// ─────────────────────────────────────────────────────────────
// Settings & Users Worker Bridge (Node.js Worker Thread Dispatcher)
// ─────────────────────────────────────────────────────────────
import path from 'path'
import { Worker } from 'worker_threads'

const {
  auditSettingsIntegrity,
  auditUserSecurityCompliance,
  reconcileBranchAndOrgSettings,
} = require('./workers/settings-users-audit.worker.js')

export function runSettingsUsersWorker<TInput, TOutput>(
  command:
    | 'AUDIT_SETTINGS_INTEGRITY'
    | 'AUDIT_USER_SECURITY_COMPLIANCE'
    | 'RECONCILE_BRANCH_AND_ORG_SETTINGS',
  payload: TInput
): Promise<TOutput> {
  if (typeof Worker === 'undefined') {
    return Promise.resolve(runSynchronousFallback<TInput, TOutput>(command, payload))
  }

  return new Promise<TOutput>((resolve, reject) => {
    try {
      const workerPath = path.resolve(__dirname, 'workers/settings-users-audit.worker.js')
      const worker = new Worker(workerPath)
      const taskId = `cfg_${Date.now()}_${Math.random().toString(36).substring(7)}`

      const timeout = setTimeout(() => {
        void worker.terminate()
        try {
          resolve(runSynchronousFallback<TInput, TOutput>(command, payload))
        } catch (err) {
          reject(err)
        }
      }, 5000)

      worker.on(
        'message',
        (msg: { id: string; success: boolean; data?: TOutput; error?: string }) => {
          if (msg.id === taskId) {
            clearTimeout(timeout)
            void worker.terminate()
            if (msg.success && msg.data !== undefined) {
              resolve(msg.data)
            } else {
              reject(new Error(msg.error || 'Settings worker execution error'))
            }
          }
        }
      )

      worker.on('error', (err) => {
        clearTimeout(timeout)
        void worker.terminate()
        try {
          resolve(runSynchronousFallback<TInput, TOutput>(command, payload))
        } catch {
          reject(err)
        }
      })

      worker.postMessage({ id: taskId, command, payload })
    } catch {
      resolve(runSynchronousFallback<TInput, TOutput>(command, payload))
    }
  })
}

function runSynchronousFallback<TInput, TOutput>(command: string, payload: TInput): TOutput {
  switch (command) {
    case 'AUDIT_SETTINGS_INTEGRITY':
      return auditSettingsIntegrity(payload) as TOutput
    case 'AUDIT_USER_SECURITY_COMPLIANCE':
      return auditUserSecurityCompliance(payload) as TOutput
    case 'RECONCILE_BRANCH_AND_ORG_SETTINGS':
      return reconcileBranchAndOrgSettings(payload) as TOutput
    default:
      throw new Error(`Unknown command in settings worker fallback: ${command}`)
  }
}

