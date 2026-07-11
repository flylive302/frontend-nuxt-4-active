import { describe, it, expect } from 'vitest'
import { resolveBadgeAsset } from '../../app/utils/badgeVisual'

describe('resolveBadgeAsset', () => {
  it('is static when assetUrl is undefined', () => {
    const result = resolveBadgeAsset('https://cdn.example.com/badge.png', undefined)
    expect(result.animated).toBe(false)
    expect(result.src).toBe('https://cdn.example.com/badge.png')
  })

  it('is static when assetUrl is null', () => {
    const result = resolveBadgeAsset('https://cdn.example.com/badge.png', null)
    expect(result.animated).toBe(false)
  })

  it('is static when assetUrl is an empty string', () => {
    const result = resolveBadgeAsset('https://cdn.example.com/badge.png', '')
    expect(result.animated).toBe(false)
  })

  it('is animated when assetUrl is a non-empty string', () => {
    const result = resolveBadgeAsset(
      'https://cdn.example.com/badge.png',
      'https://cdn.example.com/badge.svga'
    )
    expect(result.animated).toBe(true)
    expect(result.src).toBe('https://cdn.example.com/badge.png')
  })
})
