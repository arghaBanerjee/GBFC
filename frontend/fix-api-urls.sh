#!/bin/bash
# Script to properly update fetch calls to use apiUrl helper

# For Practice.jsx
sed -i '' "1 a\\
import { apiUrl } from '../api'
" src/pages/Practice.jsx

sed -i '' "s|fetch('/api/practice/sessions')|fetch(apiUrl('/api/practice/sessions'))|g" src/pages/Practice.jsx
sed -i '' "s|fetch('/api/practice/availability'|fetch(apiUrl('/api/practice/availability')|g" src/pages/Practice.jsx
sed -i '' "s|fetch(\`/api/practice/availability|fetch(apiUrl(\`/api/practice/availability|g" src/pages/Practice.jsx

# For Forum.jsx
sed -i '' "1 a\\
import { apiUrl } from '../api'
" src/pages/Forum.jsx

sed -i '' "s|fetch('/api/forum')|fetch(apiUrl('/api/forum'))|g" src/pages/Forum.jsx
sed -i '' "s|fetch('/api/forum/likes/me'|fetch(apiUrl('/api/forum/likes/me')|g" src/pages/Forum.jsx
sed -i '' "s|fetch('/api/forum/upload-image'|fetch(apiUrl('/api/forum/upload-image')|g" src/pages/Forum.jsx
sed -i '' "s|fetch(\`/api/forum/|fetch(apiUrl(\`/api/forum/|g" src/pages/Forum.jsx

# For Admin.jsx
sed -i '' "1 a\\
import { apiUrl } from '../api'
" src/pages/Admin.jsx

sed -i '' "s|fetch('/api/events')|fetch(apiUrl('/api/events'))|g" src/pages/Admin.jsx
sed -i '' "s|fetch('/api/practice/sessions')|fetch(apiUrl('/api/practice/sessions'))|g" src/pages/Admin.jsx
sed -i '' "s|fetch('/api/forum')|fetch(apiUrl('/api/forum'))|g" src/pages/Admin.jsx
sed -i '' "s|fetch('/api/upload-image'|fetch(apiUrl('/api/upload-image')|g" src/pages/Admin.jsx
sed -i '' "s|fetch(\`/api/events/|fetch(apiUrl(\`/api/events/|g" src/pages/Admin.jsx
sed -i '' "s|fetch(\`/api/practice/|fetch(apiUrl(\`/api/practice/|g" src/pages/Admin.jsx
sed -i '' "s|fetch(\`/api/forum/|fetch(apiUrl(\`/api/forum/|g" src/pages/Admin.jsx

echo "API URLs updated successfully!"
