declare module 'vue-resize' {
  import type { App, Component } from 'vue'

  export interface ResizeObserverElement extends HTMLObjectElement {
    contentDocument?: Document | null
  }

  export interface ResizeObserverInstance {
    $el: HTMLElement
    _resizeObject: ResizeObserverElement | null
    emitSize: () => void
    compareAndNotify: () => void
    addResizeHandlers: ResizeObserverHandlerWithOriginal
    removeResizeHandlers: ResizeObserverHandlerWithOriginal
  }

  export type ResizeObserverHandler = (this: ResizeObserverInstance) => void

  export type ResizeObserverHandlerWithOriginal = ResizeObserverHandler & {
    _original?: ResizeObserverHandler
  }

  export interface ResizeObserverMethods {
    addResizeHandlers: ResizeObserverHandlerWithOriginal
    removeResizeHandlers: ResizeObserverHandlerWithOriginal
    compareAndNotify: () => void
    emitSize: () => void
  }

  export const ResizeObserver: Component & {
    methods?: ResizeObserverMethods
  }

  export function install(app: App): void

  const plugin: {
    install: typeof install
    version?: string
  }

  export default plugin
}
