declare module 'vue-virtual-scroller' {
    import type { DefineComponent, Plugin } from 'vue'
    export const RecycleScroller: DefineComponent<any, any, any>
    export const DynamicScroller: DefineComponent<any, any, any>
    export const DynamicScrollerItem: DefineComponent<any, any, any>
    export const DynamicScrollerGrid: DefineComponent<any, any, any>
    const plugin: Plugin
    export default plugin
}
