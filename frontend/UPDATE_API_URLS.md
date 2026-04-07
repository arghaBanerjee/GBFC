# API URL Update Script

This document tracks the update of all fetch calls to use the apiUrl helper.

## Files Updated:
- **Completed Files**:
  - Signup.jsx
  - Login.jsx
  - App.jsx
  - About.jsx
  - Matches.jsx (formerly Events.jsx)
  - Calendar.jsx (formerly Practice.jsx)
  - Forum.jsx
  - Admin.jsx
  - UserActions.jsx

## Recent API Endpoint Changes (April 2026):

### Calendar Events API
- **Old**: `/api/calendar-events/*`
- **New**: `/api/calendar/events/*`
- **Status**: All endpoints updated and backward compatible

### Matches API
- **Old**: `/api/events/*`
- **New**: `/api/matches/*`
- **Status**: All endpoints updated and backward compatible

## Component Renames:
- `Practice.jsx` -> `Calendar.jsx`
- `Events.jsx` -> `Matches.jsx`

## Pattern:
Replace: `fetch('/api/...')`
With: `fetch(apiUrl('/api/...'))`

And add import: `import { apiUrl } from '../api'`

## Notes:
- All API calls now use the apiUrl helper function
- Backward compatibility maintained for legacy endpoints
- Frontend URLs updated from `/user-actions/*` to `/user/*`
