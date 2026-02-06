import { d as defineEventHandler, g as getRequestIP } from '../../nitro/nitro.mjs';
import 'node:http';
import 'node:https';
import 'node:events';
import 'node:buffer';
import 'node:fs';
import 'node:path';
import 'node:crypto';
import '@iconify/utils';
import 'consola';
import 'node:url';
import 'ipx';

const detectCountry = defineEventHandler(async (event) => {
  var _a, _b;
  try {
    const ip = getRequestIP(event, { xForwardedFor: true });
    if (!ip || ip === "127.0.0.1" || ip === "::1") {
      return { country_code: null };
    }
    const response = await $fetch(`https://get.geojs.io/v1/ip/country/${ip}.json`, {
      timeout: 3e3
      // 3 second timeout
    });
    return {
      country_code: (_b = (_a = response.country) == null ? void 0 : _a.toUpperCase()) != null ? _b : null
    };
  } catch (error) {
    console.error("Geolocation error:", error);
    return { country_code: null };
  }
});

export { detectCountry as default };
//# sourceMappingURL=detect-country.mjs.map
