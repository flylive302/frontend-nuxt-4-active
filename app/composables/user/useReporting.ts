// ========================================
// Reporting Composable
// ========================================
// Role: Action — submit a content/user report.
// Pipeline: EXECUTE (POST /reports) → REACT (toast feedback).
// Components call submitReport(); they never touch useApi directly.

import { createLogger } from '~/utils/logger'

export type ReportableType = 'user' | 'message' | 'room'

export type ReportReason =
  | 'harassment'
  | 'spam'
  | 'inappropriate_content'
  | 'impersonation'
  | 'hate_speech'
  | 'other'

export interface SubmitReportPayload {
  reportableType: ReportableType
  reportableId: number
  reason: ReportReason
  description?: string
}

export function useReporting() {
  const { api } = useApi()
  const toast = useToast()
  const log = createLogger('[Reporting]')

  /**
   * Submit a report. Returns true on success, false on failure.
   * Surfaces success/error feedback via toast (REACT).
   */
  async function submitReport(payload: SubmitReportPayload): Promise<boolean> {
    // EXECUTE
    try {
      await api('/reports', {
        method: 'POST',
        body: {
          reportable_type: payload.reportableType,
          reportable_id: payload.reportableId,
          reason: payload.reason,
          description: payload.description || undefined,
        },
      })

      // REACT
      toast.add({
        title: 'Report submitted',
        description: 'We review all reports within 24 hours.',
        color: 'success',
      })
      return true
    } catch (err) {
      log.warn('Failed to submit report', err)
      toast.add({
        title: 'Failed to submit report',
        description: 'Please try again.',
        color: 'error',
      })
      return false
    }
  }

  return { submitReport }
}
