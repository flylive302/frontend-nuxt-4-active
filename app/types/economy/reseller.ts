/**
 * TypeScript types for Reviewer API
 */

// ========================================
// API Response Types
// ========================================

/**
 * Standard API response wrapper used by the backend
 * Note: Backend returns status: "success" not success: boolean
 */
export interface ApiResponse<T> {
  status: string  // "success" or error status
  message: string
  data: T
  meta?: {
    timestamp?: string
    correlation_id?: string
  }
}

/**
 * Validation error response (422 status)
 */
export interface ApiValidationError {
  success: false
  message: string
  errors: Record<string, string[]>
}

// ========================================
// Reviewer Types
// ========================================

/**
 * Reviewer data returned from API endpoints:
 * - GET /api/reviewers
 * - GET /api/user/default-reviewer
 */
export interface ResellerApiRow {
  id: number        // Unique identifier for update requests
  name: string      // Display name
  signature: string // Unique identifier slug
  contact: string   // Phone (formatted) or email
  avatar: string | null    // Avatar URL (can be null)
}

/**
 * Request body for updating default reviewer
 * PUT /api/user/default-reviewer
 */
export interface UpdateDefaultResellerRequest {
  reviewer_id: number
}
