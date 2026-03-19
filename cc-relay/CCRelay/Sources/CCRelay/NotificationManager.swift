import Foundation
import UserNotifications

final class NotificationManager: NSObject, UNUserNotificationCenterDelegate {
    private let queueManager: QueueManager
    private let center = UNUserNotificationCenter.current()

    static let categoryIdentifier = "CC_RELAY_APPROVAL"
    static let approveActionIdentifier = "APPROVE"
    static let blockActionIdentifier = "BLOCK"

    init(queueManager: QueueManager) {
        self.queueManager = queueManager
        super.init()
        center.delegate = self
        registerCategory()
    }

    func requestAuthorization() {
        center.requestAuthorization(options: [.alert, .sound, .badge]) { granted, error in
            if let error = error {
                NSLog("[cc-relay] Notification authorization error: %@", error.localizedDescription)
            }
            NSLog("[cc-relay] Notification authorization granted: %@", granted ? "yes" : "no")
        }
    }

    private func registerCategory() {
        let approveAction = UNNotificationAction(
            identifier: Self.approveActionIdentifier,
            title: "Approve",
            options: []
        )
        let blockAction = UNNotificationAction(
            identifier: Self.blockActionIdentifier,
            title: "Block",
            options: [.destructive]
        )
        let category = UNNotificationCategory(
            identifier: Self.categoryIdentifier,
            actions: [approveAction, blockAction],
            intentIdentifiers: [],
            options: []
        )
        center.setNotificationCategories([category])
    }

    func fireNotification(for event: ApprovalEvent) {
        let content = UNMutableNotificationContent()
        content.title = "Claude Code"
        content.subtitle = "\(event.repoName) (\(event.branch))"

        let body = event.message
        content.body = body.count > 100 ? String(body.prefix(100)) + "…" : body

        content.sound = UNNotificationSound(named: UNNotificationSoundName("Glass"))
        content.categoryIdentifier = Self.categoryIdentifier
        content.userInfo = ["session_id": event.sessionId]

        let request = UNNotificationRequest(
            identifier: "cc-relay-\(event.sessionId)-\(Date().timeIntervalSince1970)",
            content: content,
            trigger: nil  // Deliver immediately
        )

        center.add(request) { error in
            if let error = error {
                NSLog("[cc-relay] Failed to deliver notification: %@", error.localizedDescription)
            }
        }
    }

    // MARK: - UNUserNotificationCenterDelegate

    // Handle notification actions (Approve/Block from banner)
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let actionId = response.actionIdentifier

        switch actionId {
        case Self.approveActionIdentifier:
            queueManager.respond(approval: true)
        case Self.blockActionIdentifier:
            queueManager.respond(approval: false)
        case UNNotificationDefaultActionIdentifier:
            // User tapped the notification itself — treat as approve
            queueManager.respond(approval: true)
        default:
            break
        }

        completionHandler()
    }

    // Show notifications even when app is in foreground
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([.banner, .sound])
    }
}
