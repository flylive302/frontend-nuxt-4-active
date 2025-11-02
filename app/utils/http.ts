export const localFetch = $fetch.create({
    baseURL: '/', // never touches runtimeConfig.public.apiBase
});