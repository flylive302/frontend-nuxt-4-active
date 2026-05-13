function withImageKitTransform(t,r){if(!t)return"";let a;try{a=new URL(t)}catch{return t}if(!a.hostname.includes("ik.imagekit.io"))return t;if(a.searchParams.has("tr"))return t;const i=r.q??75;return a.searchParams.set("tr",`w-${r.w},q-${i},c-maintain_ratio,f-auto`),a.toString()}export{withImageKitTransform as w};
//# sourceMappingURL=imagekit-DkFUBLwn.mjs.map
