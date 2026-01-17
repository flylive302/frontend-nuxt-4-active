// ========================================
// Realtime Events Composable
// ========================================

import type { Socket } from 'socket.io-client'
import type {
  BalanceUpdatedPayload,
  BadgeEarnedPayload,
  RewardEarnedPayload,
  RoomLevelUpPayload,
  RoomParticipantCountPayload,
  IncomeTargetCompletedPayload,
  AgencyInvitationPayload,
  AgencyJoinRequestPayload,
  AgencyStatusPayload,
  AgencyMemberJoinedPayload,
  AgencyMemberLeftPayload,
  ConfigInvalidatePayload,
  UserLevelUpPayload,
} from '~/types/socket-events'
import type { AssetInvalidatePayload } from '~/types/asset'
import * as cacheStorage from '~/services/cacheStorage'
import * as assetIndex from '~/services/assetIndex'
import * as assetDownloader from '~/services/assetDownloader'
import { createLogger } from '~/utils/logger'

const log = createLogger('[RealtimeEvents]')

// Track if handlers are already registered
let handlersRegistered = false

/**
 * Register all realtime event handlers on a socket.
 * Called once when socket connects.
 */
export function registerRealtimeEventHandlers(socket: Socket): void {
  if (handlersRegistered) {
    log.debug('Event handlers already registered, skipping')
    return
  }

  const authStore = useAuthStore()
  const roomStore = useRoomStore()
  const bootstrapStore = useBootstrapStore()

  // ========================================
  // Economy Events
  // ========================================

  socket.on('balance.updated', (payload: BalanceUpdatedPayload) => {
    log.debug('balance.updated', payload)
    authStore.updateBalance({
      coins: payload.coins,
      diamonds: payload.diamonds,
      wealth_xp: payload.wealth_xp,
      charm_xp: payload.charm_xp,
    })
  })

  socket.on('reward.earned', (payload: RewardEarnedPayload) => {
    log.debug('reward.earned', payload)
    useToast().add({
      title: 'Reward Earned!',
      description: `You earned ${payload.reward.amount} ${payload.reward.type}`,
      color: 'success',
    })
  })

  // ========================================
  // Achievement Events
  // ========================================

  socket.on('badge.earned', (payload: BadgeEarnedPayload) => {
    log.debug('badge.earned', payload)
    // Show celebratory modal with animation
    const { showBadgeEarned } = useAchievementModals()
    showBadgeEarned(payload)
  })

  socket.on('level.up', (payload: UserLevelUpPayload) => {
    log.debug('level.up', payload)
    // Update levels store with new level
    const levelsStore = useLevelsStore()
    if (payload.type === 'wealth') {
      levelsStore.updateWealthLevel(payload.new_level, payload.current_xp)
    } else {
      levelsStore.updateCharmLevel(payload.new_level, payload.current_xp)
    }
    // Show celebratory modal with animation
    const { showLevelUp } = useAchievementModals()
    showLevelUp(payload)
  })

  // ========================================
  // Room Events
  // ========================================

  socket.on('room.level_up', (payload: RoomLevelUpPayload) => {
    log.debug('room.level_up', payload)
    // Update room if it's the current room
    if (roomStore.currentRoom?.id === payload.room_id) {
      roomStore.updateRoomLevel(payload.new_level, payload.current_xp)
    }
    useToast().add({
      title: 'Room Level Up!',
      description: `${payload.room_name} is now Level ${payload.new_level}!`,
      color: 'success',
    })
  })

  socket.on('room.participant_count', (payload: RoomParticipantCountPayload) => {
    log.debug('room.participant_count', payload)
    // Update room store participant count if in a room
    if (roomStore.currentRoom) {
      roomStore.updateParticipantCount(payload.count)
    }
  })

  // ========================================
  // Income Events
  // ========================================

  socket.on('income_target.completed', (payload: IncomeTargetCompletedPayload) => {
    log.debug('income_target.completed', payload)
    useToast().add({
      title: 'Target Complete!',
      description: `You completed ${payload.name}! +${payload.member_reward} 💎`,
      color: 'success',
    })
  })

  socket.on('income_target.member_completed', (payload: IncomeTargetCompletedPayload) => {
    log.debug('income_target.member_completed', payload)
    useToast().add({
      title: 'Team Member Target Complete',
      description: `A member completed ${payload.name}! +${payload.owner_reward} 💎 for you`,
      color: 'info',
    })
  })

  // ========================================
  // Agency Events
  // ========================================

  socket.on('agency.invitation', (payload: AgencyInvitationPayload) => {
    log.debug('agency.invitation', payload)
    useToast().add({
      title: 'Agency Invitation',
      description: `${payload.invited_by.name} invited you to ${payload.agency.name}`,
      color: 'info',
    })
  })

  socket.on('agency.join_request', (payload: AgencyJoinRequestPayload) => {
    log.debug('agency.join_request', payload)
    useToast().add({
      title: 'Join Request',
      description: `${payload.user.name} wants to join your agency`,
      color: 'info',
    })
  })

  socket.on('agency.join_request_approved', (payload: AgencyStatusPayload) => {
    log.debug('agency.join_request_approved', payload)
    useToast().add({
      title: 'Request Approved!',
      description: `Welcome to ${payload.agency_name}!`,
      color: 'success',
    })
  })

  socket.on('agency.join_request_rejected', (payload: AgencyStatusPayload) => {
    log.debug('agency.join_request_rejected', payload)
    useToast().add({
      title: 'Request Declined',
      description: `Your request to ${payload.agency_name} was declined`,
      color: 'warning',
    })
  })

  socket.on('agency.member_kicked', (payload: AgencyStatusPayload) => {
    log.debug('agency.member_kicked', payload)
    useToast().add({
      title: 'Removed from Agency',
      description: `You were removed from ${payload.agency_name}`,
      color: 'warning',
    })
  })

  socket.on('agency.dissolved', (payload: AgencyStatusPayload) => {
    log.debug('agency.dissolved', payload)
    useToast().add({
      title: 'Agency Dissolved',
      description: `${payload.agency_name} has been dissolved`,
      color: 'info',
    })
  })

  socket.on('agency.member_joined', (payload: AgencyMemberJoinedPayload) => {
    log.debug('agency.member_joined', payload)
    useToast().add({
      title: 'New Member Joined',
      description: 'A new member has joined your agency!',
      color: 'success',
    })
    // TODO: Optionally refresh agency member list
  })

  socket.on('agency.member_left', (payload: AgencyMemberLeftPayload) => {
    log.debug('agency.member_left', payload)
    useToast().add({
      title: 'Member Left',
      description: `A member has left your agency (${payload.reason})`,
      color: 'info',
    })
    // TODO: Optionally refresh agency member list
  })

  // ========================================
  // System Events
  // ========================================

  socket.on('config:invalidate', (payload: ConfigInvalidatePayload) => {
    log.debug('config:invalidate', payload)
    bootstrapStore.invalidateConfig(payload.type)
  })

  // ========================================
  // Asset Cache Events
  // ========================================

  socket.on('asset:invalidate', async (payload: AssetInvalidatePayload) => {
    log.debug('asset:invalidate', payload)
    
    // Remove from cache storage
    await cacheStorage.deleteAsset(payload.url)
    
    // Remove from IndexedDB metadata
    await assetIndex.remove(payload.url)
    
    // Re-download if critical
    if (payload.priority === 'critical') {
      assetDownloader.enqueueManual(payload.url, {
        priority: 'critical',
        assetType: 'video', // Default, will be determined by URL
      })
    }
    
    log.debug('Asset invalidated:', payload.url)
  })

  handlersRegistered = true
  log.debug('All realtime event handlers registered')
}

/**
 * Reset handler registration state (call on disconnect).
 */
export function resetRealtimeHandlers(): void {
  handlersRegistered = false
}
