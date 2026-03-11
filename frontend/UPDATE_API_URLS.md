# API URL Update Script

This document tracks the update of all fetch calls to use the apiUrl helper.

## Files Updated:
- ✅ Signup.jsx
- ✅ Login.jsx
- ✅ App.jsx
- ✅ About.jsx
- ✅ Events.jsx
- ⏳ Practice.jsx (in progress)
- ⏳ Forum.jsx (in progress)
- ⏳ Admin.jsx (in progress)

## Pattern:
Replace: `fetch('/api/...')`
With: `fetch(apiUrl('/api/...'))`

And add import: `import { apiUrl } from '../api'`
