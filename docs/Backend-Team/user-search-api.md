# User Search API Documentation

**Endpoint**: `GET /api/v1/users/search`
**Auth Required**: Yes (Bearer Token)

## Request Parameters

| Parameter  | Type   | Required | Description                                                          |
| :--------- | :----- | :------- | :------------------------------------------------------------------- |
| `search`   | string | No       | The search term. If empty, returns no results.                       |
| `per_page` | int    | No       | Number of results per page. Default: `15`.                           |
| `cursor`   | string | No       | The cursor string for pagination (obtained from `meta.next_cursor`). |

## Response Structure

The API returns a **Cursor Paginated** response.

```json
{
  "status": "success",
  "message": "Users retrieved successfully",
  "data": [
    {
      "id": 101,
      "name": "Alice Wonderland",
      "phone": {
        "raw": "+15550100",
        "formatted": "+1 555-0100",
        "country": "US"
      },
      "email": "alice@example.com",
      "signature": "Chasing rabbits",
      "avatar": "https://cdn.example.com/avatars/alice.jpg"
    }
  ],
  "meta": {
    "pagination": {
      "path": "https://api.flylive.com/api/v1/users/search",
      "per_page": 15,
      "next_cursor": "eyJpZCI6MTAxLCJfdGltZXN0YW1wIjoxNj...",
      "prev_cursor": "eyJpZCI6MTA1LCJfdGltZXN0YW1wIjoxNj..."
    }
    // ... timestamp, correlation_id
  }
}
```

## Implementation Notes

1.  **Search Logic**:
    - If `search` is numeric, it checks for an exact User ID match.
    - It always checks for partial matches on `name` OR `signature`.
2.  **Pagination**:
    - To get the next page, send the requested `cursor` parameter with the value of `meta.next_cursor` from the previous response.
    - If `meta.next_cursor` is `null`, there are no more results.
3.  **Data Privacy**:
    - This endpoint returns `id`, `name`, `phone`, `email`, `signature`, and `avatar`.
    - Extended profile fields (coins, XP, roles) are **excluded** for performance.
