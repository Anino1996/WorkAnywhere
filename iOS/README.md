# CloudAgent Workspace — iOS App

SwiftUI-based iOS application for CloudAgent Workspace. Enables users to manage workspaces, view projects, and interact with the cloud coding environment from their iPhone or iPad.

## Project Structure

```
iOS/
├── CloudAgentWorkspace/              # Main app code
│   ├── CloudAgentWorkspaceApp.swift  # App entry point
│   ├── Views/
│   │   ├── ContentView.swift         # Tab navigation root
│   │   ├── Home/                     # Home screen + components
│   │   ├── Chat/                     # Chat interface (stub)
│   │   └── Settings/                 # Settings (stub)
│   ├── Models/
│   │   ├── Workspace.swift
│   │   └── Project.swift
│   ├── Services/
│   │   └── APIClient.swift           # Backend communication
│   ├── Assets/
│   │   ├── LaunchScreen.storyboard
│   │   └── Assets.xcassets/          # App icons, colors, images
│   └── Info.plist                    # App configuration
├── CloudAgentWorkspace.xcodeproj/    # Xcode project
├── .gitignore
└── README.md

```

## System Requirements

- **Xcode:** 15.4 or later
- **Deployment Target:** iOS 15.0+
- **Swift:** 5.9+

## Build Configuration

### Debug Build
```bash
xcodebuild -scheme CloudAgentWorkspace -configuration Debug
```

### Release Build
```bash
xcodebuild -scheme CloudAgentWorkspace -configuration Release -archivePath CloudAgentWorkspace.xcarchive
```

## Build Settings

**Key Configuration Values:**

| Setting | Value |
|---------|-------|
| Deployment Target | iOS 15.0 |
| Swift Language | 5.9 |
| Swift Strict Concurrency | Complete |
| Bundle Identifier | `com.cloudagent.workspace` |
| Minimum OS Version | iOS 15.0 |
| Supported Devices | iPhone & iPad (portrait & landscape) |
| Preferred Color Scheme | Automatic (light/dark) |

**Debug-Specific:**
- Optimization: None (`-Onone`)
- Debug Info: Full (`dwarf`)
- Testability: Enabled
- Active Architecture Only: Yes

**Release-Specific:**
- Optimization: Size (`-Osize`)
- Debug Info: Symbols only (`dwarf-with-dsym`)
- Validation: Enabled
- Optimization: Size preferred

## Network Configuration

The app connects to the CloudAgent Workspace control plane API:

**Endpoint:** `http://localhost:8080/api/v1` (configurable in `APIClient.swift`)

**Info.plist Security Settings:**
- Allows local network access (required for development)
- Supports mDNS discovery via `_cloudagent._tcp`
- Temporary exception for localhost HTTP (development only)

**Production:** Update `NSAppTransportSecurity` to require HTTPS and remove development exceptions.

## Opening in Xcode

```bash
open CloudAgentWorkspace.xcodeproj
```

The project will open in Xcode with all source files, build configurations, and asset catalogs ready for development.

## Architecture

- **UI Framework:** SwiftUI
- **State Management:** MVVM (ObservedObject + StateObject)
- **Concurrency:** Async/Await
- **Networking:** URLSession
- **Code Organization:** MVVM with separation of concerns

## Features (Phase 1)

- Workspace management (list, resume, create)
- Recent projects display
- AI model selection (GPT-4, Claude, Gemini)
- Bottom tab navigation
- Real-time workspace state polling

## Development

1. Open `CloudAgentWorkspace.xcodeproj` in Xcode
2. Select a simulator or device
3. Press `Cmd+R` to build and run
4. Live preview available via SwiftUI canvas

## Future Work

- File explorer (Files tab)
- Chat interface (Chat tab)
- Settings & preferences (Settings tab)
- Terminal emulation
- SSH integration
- Workspace shortcuts
- Offline support
