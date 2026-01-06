# User Signature System

## Overview

User signatures are **unique 7-digit numeric identifiers** (e.g., `3592010`).

## Key Points

- **Format**: 7-digit number between `1000000` and `9999999`
- **Auto-generated**: Created automatically during user registration
- **User Cannot Edit**: Regular users cannot change their own signature
- **Officials Can Edit**: Staff with appropriate permissions can modify user signatures

## API Response Example

```json
{
  "user": {
    "id": 123,
    "name": "John Doe",
    "signature": "3592010",
    ...
  }
}
```

## Display Recommendations

- Show signature as a unique user ID
- Can be displayed with a prefix like "ID: 3592010" or "#3592010"
- Useful for customer support reference

## Changes from Previous Version

| Before                        | After                   |
| ----------------------------- | ----------------------- |
| `firstname_lastname_123`      | `3592010`               |
| Name-based format             | 7-digit numeric         |
| User could potentially change | Only officials can edit |
