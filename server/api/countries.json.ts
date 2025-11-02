// server/api/countries.json.ts
export default defineEventHandler(() => {
    return $fetch('/countries.json')
})