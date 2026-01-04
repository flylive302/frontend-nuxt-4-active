# Backend Fix Request: /user/income API Missing Fields

> **Issue Type:** Bug - Missing API fields
> **Priority:** High
> **Reported:** 2026-01-04
> **Affects:** Agency Income Dashboard - Recent Earnings component

---

## Issue Summary

The `GET /user/income` endpoint is returning incomplete data. The `recent_earnings` and `summary` fields are missing from the API response, causing the frontend "Recent Earnings" component to show "No recent earnings" even when the user has received gifts and completed income targets.

---

## Evidence

**User Context:**
- Agency member "haider ali" has completed T1 target (required 700 coins)
- Currently on T2 target with 150 XP earned toward 5000 XP requirement
- This proves gifts have been received, yet "Recent Earnings" shows empty

**Actual API Response:**
```json
{
  "success": true,
  "data": {
    "active_target": {
      "tier": "T2",
      "earned_coins": 150,
      "required_coins": 5000,
      "progress_percentage": 3,
      "days_remaining": 6,
      "diamond_reward": 50
    },
    "completed_targets": 1,
    "total_diamonds_earned": 10
  }
}
```

**Expected Response (per docs/mega_feature/01-api-reference.md lines 368-409):**
```json
{
  "success": true,
  "data": {
    "summary": {
      "total_coins_earned": "15000.0000",
      "total_diamonds": "150",
      "claimable_rewards": 3,
      "pending_targets": 1
    },
    "active_target": {
      "id": 456,
      "tier": "T2",
      "name": "Tier 2",
      "required_coins": "5000.0000",
      "earned_coins": "3500.0000",
      "progress_percentage": 70,
      "period_start": "2025-12-23T00:00:00Z",
      "period_end": "2025-12-30T00:00:00Z",
      "days_remaining": 1,
      "member_diamond_reward": 50,
      "owner_diamond_reward": 25
    },
    "recent_earnings": [
      {
        "date": "2025-12-29",
        "amount": "500.0000",
        "source": "gift_receive",
        "count": 5
      }
    ]
  }
}
```

---

## Missing Fields

| Field | Status | Description |
|-------|--------|-------------|
| `summary.total_coins_earned` | ❌ Missing | Total lifetime coins earned |
| `summary.total_diamonds` | ❌ Missing | Total diamonds earned |
| `summary.claimable_rewards` | ❌ Missing | Count of unclaimed rewards |
| `summary.pending_targets` | ❌ Missing | Count of pending targets |
| `recent_earnings` | ❌ Missing | Array of recent earning records grouped by date |

---

## Required Fix

### 1. Add `recent_earnings` to Response

The `recent_earnings` array should contain earning records from the last 7 days (or configurable period), grouped by date:

```php
$recentEarnings = $user->transactions()
    ->where('type', 'income')  // or appropriate filter for gift_receive, room_commission
    ->where('created_at', '>=', now()->subDays(7))
    ->selectRaw('DATE(created_at) as date, SUM(amount) as amount, COUNT(*) as count')
    ->groupBy('date')
    ->orderBy('date', 'desc')
    ->get()
    ->map(fn($row) => [
        'date' => $row->date,
        'date_formatted' => Carbon::parse($row->date)->format('d F, Y'),
        'amount' => number_format($row->amount, 4, '.', ''),
        'source' => 'gift',  // Adjust based on transaction type
        'count' => $row->count,
    ]);
```

### 2. Add `summary` Object

Include aggregate statistics:

```php
'summary' => [
    'total_coins_earned' => $user->total_income ?? '0.0000',
    'total_diamonds' => $user->diamonds ?? 0,
    'claimable_rewards' => $user->pendingRewards()->count(),
    'pending_targets' => $user->incomeTargets()->active()->count(),
],
```

---

## Frontend Type Reference

The frontend expects this TypeScript structure:

```typescript
interface RecentEarning {
  date: string         // YYYY-MM-DD
  date_formatted: string  // "29 December, 2025"
  amount: string       // "500.0000"
  source: 'gift' | 'room_commission' | 'other'
  count: number        // Number of transactions
}

interface IncomeSummary {
  total_earned: string
  total_this_month: string
  total_this_week: string
  total_today: string
  average_daily: string
  recent_earnings: RecentEarning[]
}
```

---

## Files to Check

1. **Controller**: Look for the controller handling `GET /user/income` route
2. **Resource**: Check if there's an `IncomeResource` or similar that transforms the response
3. **Service**: Any `IncomeService` or `AgencyIncomeService` that calculates earnings

---

## Testing

After the fix, verify the API returns:
1. `recent_earnings` array with at least one entry when user has received gifts
2. Correct `date`, `date_formatted`, `amount`, `source`, and `count` fields
3. Proper aggregation by date (multiple gift receives on same day = one entry with count > 1)
