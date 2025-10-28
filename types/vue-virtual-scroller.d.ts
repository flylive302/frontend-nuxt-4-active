import type {
  DynamicScroller as DynamicScrollerType,
  DynamicScrollerItem as DynamicScrollerItemType,
  RecycleScroller as RecycleScrollerType,
} from 'vue-virtual-scroller'

declare module 'vue' {
  export interface GlobalComponents {
    DynamicScroller: typeof DynamicScrollerType
    DynamicScrollerItem: typeof DynamicScrollerItemType
    RecycleScroller: typeof RecycleScrollerType
  }
}

export {}
