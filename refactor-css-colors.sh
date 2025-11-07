#!/bin/bash
# Script to replace hardcoded colors with CSS variables

CSS_FILE="public/css/style.css"

# Gray scale
sed -i 's/#f9fafb/var(--gray-50)/g' "$CSS_FILE"
sed -i 's/#f4f4f4/var(--gray-100)/g' "$CSS_FILE"
sed -i 's/#e5e7eb/var(--gray-200)/g' "$CSS_FILE"
sed -i 's/#d1d5db/var(--gray-300)/g' "$CSS_FILE"
sed -i 's/#9ca3af/var(--gray-400)/g' "$CSS_FILE"
sed -i 's/#6b7281/var(--gray-500)/g' "$CSS_FILE"
sed -i 's/#4b5563/var(--gray-600)/g' "$CSS_FILE"
sed -i 's/#374151/var(--gray-700)/g' "$CSS_FILE"
sed -i 's/#1f2937/var(--gray-800)/g' "$CSS_FILE"
sed -i 's/#111827/var(--gray-900)/g' "$CSS_FILE"

# Common hardcoded values
sed -i 's/#333/var(--text-primary)/g' "$CSS_FILE"
sed -i 's/#555/var(--gray-600)/g' "$CSS_FILE"
sed -i 's/#666/var(--text-muted)/g' "$CSS_FILE"
sed -i 's/#ccc/var(--gray-300)/g' "$CSS_FILE"
sed -i 's/#ddd/var(--gray-300)/g' "$CSS_FILE"
sed -i 's/#eee/var(--gray-200)/g' "$CSS_FILE"

# Red/Error colors
sed -i 's/#f8d7da/var(--bg-error)/g' "$CSS_FILE"
sed -i 's/#721c24/var(--t4t-red-hover)/g' "$CSS_FILE"
sed -i 's/#fef2f2/var(--t4t-red-light)/g' "$CSS_FILE"
sed -i 's/#fecaca/var(--t4t-red-border)/g' "$CSS_FILE"
sed -i 's/#a01828/var(--t4t-red-hover)/g' "$CSS_FILE"

# Green/Success colors
sed -i 's/#d4edda/var(--bg-success)/g' "$CSS_FILE"
sed -i 's/#155724/var(--t4t-green-dark)/g' "$CSS_FILE"
sed -i 's/#f0fdf4/var(--t4t-green-light)/g' "$CSS_FILE"
sed -i 's/#bbf7d0/var(--t4t-green-border)/g' "$CSS_FILE"
sed -i 's/#15803d/var(--t4t-green-dark)/g' "$CSS_FILE"
sed -i 's/#16a34a/var(--btn-primary)/g' "$CSS_FILE"
sed -i 's/#059669/var(--btn-primary)/g' "$CSS_FILE"
sed -i 's/#047857/var(--btn-primary-hover)/g' "$CSS_FILE"
sed -i 's/#22c55e/var(--t4t-green)/g' "$CSS_FILE"
sed -i 's/#1a7f37/var(--t4t-green-dark)/g' "$CSS_FILE"
sed -i 's/#d1fae5/var(--bg-success)/g' "$CSS_FILE"

# Blue colors
sed -i 's/#3b82f6/var(--marine-blue)/g' "$CSS_FILE"
sed -i 's/#2563eb/var(--marine-blue-dark)/g' "$CSS_FILE"
sed -i 's/#eef5ff/var(--gray-50)/g' "$CSS_FILE"
sed -i 's/#e3f2fd/var(--gray-100)/g' "$CSS_FILE"
sed -i 's/#002244/var(--marine-blue-dark)/g' "$CSS_FILE"

# Red button colors
sed -i 's/#ef4444/var(--t4t-red)/g' "$CSS_FILE"
sed -i 's/#dc2626/var(--t4t-red-hover)/g' "$CSS_FILE"

# Yellow/warning colors
sed -i 's/#eab308/var(--bg-warning)/g' "$CSS_FILE"
sed -i 's/#fee2e2/var(--bg-error)/g' "$CSS_FILE"

# Misc
sed -i 's/#f8f9fa/var(--gray-50)/g' "$CSS_FILE"

echo "CSS color refactoring complete!"
