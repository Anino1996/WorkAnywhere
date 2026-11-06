# Mobile App — Home Page Design

## Overview

SwiftUI-based iOS app for CloudAgent Workspace. Home page serves as the main hub: workspace management, recent projects, AI model selection, and navigation to coding interface.

## Visual Structure

### Header Section
- Status bar (system-managed)
- Welcome message with user greeting
- Subtitle tagline

### Workspaces Section
- Horizontally scrollable card grid
- Active workspace card (with status badge)
- "+ Start New Workspace" card
- Each card tappable to open/resume workspace

### Recent Projects Section
- Vertical list (3–5 items)
- Project icon + name + last updated timestamp
- "See all" link to full list

### AI Model Selector
- Segmented control: GPT-4 | Claude (default) | Gemini
- Updates user preference in settings

### Call-to-Action Area
- Primary button: "Start Coding" → opens workspace
- Secondary button: "View Diffs" → diff viewer

### Bottom Navigation
- Tab bar: Home (active) | Files | Chat | Settings
- Persists across all screens

## Data Flow

```
Home Load
├─ GET /api/v1/workspaces → card grid
├─ GET /api/v1/workspaces/{id}/operations → poll for state changes
├─ GET /api/v1/projects?limit=3 → recent projects
└─ GET /user/settings → load AI model preference
```

Real-time updates: Poll every 2–3 seconds during provisioning/resuming states.

## Layout Specifications

**Safe Area Padding:** 16px vertical, 12px horizontal

**Workspace Cards:**
- Width: 100% minus padding
- Height: 120px
- Corner radius: 12pt
- Border: 1pt, accent color on active state

**Project List Rows:**
- Height: 64pt
- Icon size: 40pt
- Typography: headline (17pt) + caption (13pt)

**Bottom Tab Bar:**
- Height: 60pt (including safe area)
- Fixed position

## SwiftUI Implementation Details

**State Management:**
- MVVM pattern
- @StateObject for view models
- @ObservedObject for workspace polling
- Combine publishers for real-time updates

**Navigation:**
- NavigationStack (iOS 16+) for hierarchical navigation
- TabView for bottom tab bar

**Responsive Design:**
- Base: iPhone SE (375pt)
- Adaptive layouts for iPad / larger devices
- Horizontal safe area for notch/Dynamic Island

## Backend Integration

- Endpoint prefix: `/api/v1`
- Add `?client=mobile` query param for mobile-optimized responses
- Polling interval: 2–3 seconds (reduce to 5+ seconds when no operations in progress)
- WebSocket upgrade path: Replace polling with real-time updates via WebSocket

## Future Enhancements

- Biometric unlock (Face ID / Touch ID)
- Workspace shortcuts
- Quick-access to favorite projects
- Offline mode (cached workspace state)
- Dark mode support
