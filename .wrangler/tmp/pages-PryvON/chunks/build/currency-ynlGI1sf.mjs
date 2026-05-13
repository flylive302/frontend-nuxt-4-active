function formatCurrency(t){const e="string"==typeof t?function(t){if(!t)return 0;const e=parseFloat(t);return isNaN(e)?0:e}(t):t??0;return e>=1e6?`${(e/1e6).toFixed(1)}M`:e>=1e3?`${(e/1e3).toFixed(1)}K`:e.toFixed(0)}export{formatCurrency as f};
//# sourceMappingURL=currency-ynlGI1sf.mjs.map
