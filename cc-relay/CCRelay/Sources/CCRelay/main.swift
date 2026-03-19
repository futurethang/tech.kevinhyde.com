import AppKit
import KeyboardShortcuts

// Register hotkey name
extension KeyboardShortcuts.Name {
    static let showOverlay = Self("showOverlay", default: .init(.return, modifiers: [.command, .shift]))
}

// Configure as LSUIElement (no Dock icon)
final class AppDelegate: NSObject, NSApplicationDelegate {
    private var daemon: Daemon!
    private var overlay: OverlayWindow!

    func applicationDidFinishLaunching(_ notification: Notification) {
        // Hide from Dock
        NSApp.setActivationPolicy(.accessory)

        // Initialize components
        let queueManager = QueueManager.shared
        let notificationManager = NotificationManager(queueManager: queueManager)
        notificationManager.requestAuthorization()

        overlay = OverlayWindow(queueManager: queueManager)

        daemon = Daemon(queueManager: queueManager, notificationManager: notificationManager)
        daemon.start()

        // Register global hotkey
        KeyboardShortcuts.onKeyUp(for: .showOverlay) { [weak self] in
            guard QueueManager.shared.current != nil else { return }
            self?.overlay.showWithCurrentEvent()
        }

        NSLog("[cc-relay] Daemon started. Watching for HITL events.")
    }

    func applicationWillTerminate(_ notification: Notification) {
        daemon?.stop()
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.run()
