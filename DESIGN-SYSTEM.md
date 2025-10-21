# E-Responde Admin Dashboard - Design System

## Overview
This document outlines the design system for the E-Responde Admin Dashboard, implementing a clean monochrome theme with black, white, and gray colors.

## Color Palette

### Primary Colors
- **Black**: `#0B0B0B` - Primary text, active states, primary buttons
- **White**: `#FFFFFF` - Background, card surfaces
- **Gray Scale**: 50-900 range for subtle variations

### Gray Scale
- **Gray 50**: `#FAFAFA` - Light backgrounds, subtle borders
- **Gray 100**: `#F5F5F5` - Card backgrounds, disabled states
- **Gray 200**: `#EAEAEA` - Borders, dividers
- **Gray 300**: `#D4D4D4` - Hover states, secondary borders
- **Gray 400**: `#A3A3A3` - Placeholder text, icons
- **Gray 500**: `#6B6B6B` - Secondary text
- **Gray 600**: `#4B4B4B` - Primary text (alternative)
- **Gray 700**: `#2B2B2B` - Dark text
- **Gray 800**: `#171717` - Very dark text
- **Gray 900**: `#0B0B0B` - Black (same as primary)

### Status Colors
- **Danger**: `#D9534F` - Critical alerts, delete actions
- **Success**: `#2ECC71` - Success states, completed actions
- **Warning**: `#F0AD4E` - Warning states, pending actions

## Typography

### Font Family
- **Primary**: Inter (Google Fonts)
- **Fallback**: system-ui, sans-serif

### Font Weights
- **Light**: 300
- **Regular**: 400
- **Medium**: 500
- **Semibold**: 600
- **Bold**: 700
- **Extra Bold**: 800

### Font Sizes
- **h1**: 2rem (32px) - Page titles
- **h2**: 1.5rem (24px) - Section headers
- **h3**: 1.25rem (20px) - Subsection headers
- **Body**: 1rem (16px) - Regular text
- **Small**: 0.875rem (14px) - Secondary text
- **XS**: 0.75rem (12px) - Labels, captions

## Spacing Scale
- **xs**: 0.25rem (4px)
- **sm**: 0.5rem (8px)
- **md**: 1rem (16px)
- **lg**: 1.5rem (24px)
- **xl**: 2rem (32px)
- **2xl**: 3rem (48px)
- **3xl**: 4rem (64px)

## Component Styles

### Buttons
```css
/* Primary Button */
.btn-primary {
  @apply bg-black text-white border-black hover:bg-gray-800 hover:border-gray-800 focus:ring-gray-400;
}

/* Secondary Button */
.btn-secondary {
  @apply bg-white text-black border-gray-300 hover:bg-gray-50 hover:border-gray-400 focus:ring-gray-400;
}

/* Danger Button */
.btn-danger {
  @apply bg-status-danger text-white border-status-danger hover:bg-red-600 hover:border-red-600 focus:ring-red-400;
}
```

### Cards
```css
.card {
  @apply bg-white border border-gray-200 rounded-2xl p-6 shadow-soft transition-all duration-200;
}

.card:hover {
  @apply shadow-medium border-gray-300;
}
```

### Status Badges
```css
.status-badge {
  @apply inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider;
}

.status-pending {
  @apply bg-gray-100 text-gray-700;
}

.status-received {
  @apply bg-gray-200 text-gray-800;
}

.status-in-progress {
  @apply bg-gray-300 text-gray-900;
}

.status-resolved {
  @apply bg-black text-white;
}
```

### Priority Badges
```css
.priority-badge {
  @apply inline-flex items-center px-2 py-1 rounded text-xs font-bold uppercase tracking-wider;
}

.priority-high {
  @apply bg-status-danger text-white;
}

.priority-medium {
  @apply bg-gray-200 text-gray-800;
}

.priority-low {
  @apply bg-gray-100 text-gray-600;
}
```

## Shadows
- **Soft**: `0 2px 4px rgba(0, 0, 0, 0.06)` - Subtle elevation
- **Medium**: `0 4px 12px rgba(0, 0, 0, 0.1)` - Card hover states
- **Strong**: `0 8px 24px rgba(0, 0, 0, 0.15)` - Modals, dropdowns

## Border Radius
- **Small**: 0.375rem (6px) - Small elements
- **Medium**: 0.5rem (8px) - Buttons, inputs
- **Large**: 0.75rem (12px) - Cards, containers
- **Extra Large**: 1rem (16px) - Large cards, modals
- **2XL**: 1.5rem (24px) - Hero sections

## Accessibility

### Focus States
All interactive elements include visible focus rings:
```css
*:focus {
  @apply outline-none ring-2 ring-gray-400 ring-offset-2;
}
```

### Color Contrast
- All text meets WCAG AA standards (4.5:1 contrast ratio)
- Interactive elements have sufficient contrast
- Status indicators use color + text for accessibility

### Keyboard Navigation
- All interactive elements are keyboard accessible
- Tab order follows logical flow
- Focus management in modals and dropdowns

## Responsive Design

### Breakpoints
- **Mobile**: < 768px
- **Tablet**: 768px - 1024px
- **Desktop**: > 1024px

### Mobile Adaptations
- Sidebar slides in/out on mobile
- Tables become horizontally scrollable
- Cards stack vertically
- Touch-friendly button sizes (44px minimum)

## Usage Guidelines

### Do's
- Use the monochrome palette consistently
- Maintain proper spacing and typography hierarchy
- Ensure sufficient contrast for accessibility
- Use subtle shadows for depth
- Keep interactions smooth with transitions

### Don'ts
- Don't use colors outside the defined palette
- Don't use heavy shadows or gradients
- Don't break the spacing scale
- Don't compromise accessibility for aesthetics
- Don't use inline styles - use Tailwind classes

## Implementation Notes

### Tailwind Configuration
The design system is implemented using Tailwind CSS with custom configuration:
- Custom color palette
- Extended spacing scale
- Custom shadow definitions
- Inter font family integration

### Component Architecture
- Components use Tailwind utility classes
- Custom component classes for complex patterns
- Consistent naming conventions
- Modular and reusable design

### Performance
- Tailwind purges unused styles in production
- Minimal custom CSS for better performance
- Optimized font loading
- Efficient shadow and transition definitions
