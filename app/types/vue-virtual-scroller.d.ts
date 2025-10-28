declare module 'vue-virtual-scroller' {
    import type { DefineComponent, Plugin } from 'vue'
    export const RecycleScroller: DefineComponent
    export const DynamicScroller: DefineComponent
    export const DynamicScrollerItem: DefineComponent
    export const DynamicScrollerGrid: DefineComponent
    const plugin: Plugin
    export default plugin
}