import{b as s,v as a,w as e}from"./server.mjs";function useResolvedVariants(t,o,r,u,n){const i=s(),d={};for(const s of u)d[s]=a.computed(()=>(void 0!==n?.[s]?a.toValue(n[s]):e(o,s))??i.ui?.[t]?.defaultVariants?.[s]??r.defaultVariants?.[s]);return d}export{useResolvedVariants as u};
//# sourceMappingURL=useResolvedVariants-DvXv8LvG.mjs.map
