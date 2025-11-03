import { defineNuxtPlugin } from '#app'
import { ResizeObserver } from 'vue-resize'
import type {
  ResizeObserverHandler,
  ResizeObserverHandlerWithOriginal,
  ResizeObserverInstance,
  ResizeObserverMethods
} from 'vue-resize'

function attachResizeListener(this: ResizeObserverInstance): void {
  const view = this._resizeObject?.contentDocument?.defaultView
  if (!view) {
    requestAnimationFrame(() => {
      const nextView = this._resizeObject?.contentDocument?.defaultView
      if (!nextView) return

      nextView.addEventListener('resize', this.compareAndNotify, { passive: true })
      this.compareAndNotify()
    })
    return
  }

  view.addEventListener('resize', this.compareAndNotify, { passive: true })
  this.compareAndNotify()
}

function detachResizeListener(this: ResizeObserverInstance, fallback: ResizeObserverHandler | undefined): void {
  const view = this._resizeObject?.contentDocument?.defaultView
  if (view) {
    view.removeEventListener('resize', this.compareAndNotify)
  }

  if (fallback) {
    fallback.call(this)
    return
  }

  const resizeObject = this._resizeObject
  if (!resizeObject) return

  if (this.$el.contains(resizeObject)) {
    this.$el.removeChild(resizeObject)
  }

  resizeObject.onload = null
  this._resizeObject = null
}

export default defineNuxtPlugin(() => {
  const methods = ResizeObserver?.methods as ResizeObserverMethods | undefined
  if (!methods) return

  const originalAdd = methods.addResizeHandlers
  const originalRemove = methods.removeResizeHandlers

  const patchedAdd: ResizeObserverHandlerWithOriginal = Object.assign(
    function patchedAdd(this: ResizeObserverInstance) {
      attachResizeListener.call(this)
    },
    originalAdd ? { _original: originalAdd } : {}
  )

  const patchedRemove: ResizeObserverHandlerWithOriginal = Object.assign(
    function patchedRemove(this: ResizeObserverInstance) {
      detachResizeListener.call(this, originalRemove)
    },
    originalRemove ? { _original: originalRemove } : {}
  )

  methods.addResizeHandlers = patchedAdd
  methods.removeResizeHandlers = patchedRemove
})
