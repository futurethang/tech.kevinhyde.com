import Foundation

struct ApprovalEvent {
    let sessionId: String
    let cwd: String
    let repoName: String
    let branch: String
    let message: String
    let timestamp: Date
}

final class Daemon {
    private let queueManager: QueueManager
    private let notificationManager: NotificationManager
    private let eventsDir: URL
    private var pollTimer: DispatchSourceTimer?
    private var fsSource: DispatchSourceFileSystemObject?
    private var fileDescriptor: Int32 = -1

    init(queueManager: QueueManager, notificationManager: NotificationManager) {
        self.queueManager = queueManager
        self.notificationManager = notificationManager
        let home = FileManager.default.homeDirectoryForCurrentUser
        self.eventsDir = home.appendingPathComponent(".cc-relay/events")
    }

    func start() {
        // Ensure directories exist
        let fm = FileManager.default
        let home = fm.homeDirectoryForCurrentUser
        let relayDir = home.appendingPathComponent(".cc-relay")
        let pipesDir = relayDir.appendingPathComponent("pipes")

        try? fm.createDirectory(at: eventsDir, withIntermediateDirectories: true)
        try? fm.createDirectory(at: pipesDir, withIntermediateDirectories: true)

        // Try filesystem monitoring via DispatchSource, fall back to polling
        startWatching()
    }

    func stop() {
        fsSource?.cancel()
        fsSource = nil
        pollTimer?.cancel()
        pollTimer = nil
        if fileDescriptor >= 0 {
            close(fileDescriptor)
            fileDescriptor = -1
        }
    }

    private func startWatching() {
        let path = eventsDir.path

        // Open directory for monitoring
        fileDescriptor = open(path, O_EVTONLY)
        if fileDescriptor >= 0 {
            let source = DispatchSource.makeFileSystemObjectSource(
                fileDescriptor: fileDescriptor,
                eventMask: .write,
                queue: DispatchQueue.global(qos: .userInitiated)
            )
            source.setEventHandler { [weak self] in
                self?.scanEvents()
            }
            source.setCancelHandler { [weak self] in
                if let fd = self?.fileDescriptor, fd >= 0 {
                    close(fd)
                    self?.fileDescriptor = -1
                }
            }
            source.resume()
            fsSource = source
            NSLog("[cc-relay] Watching events directory via DispatchSource")
        } else {
            NSLog("[cc-relay] Could not open events dir for monitoring, falling back to polling")
        }

        // Always run a poll timer as a safety net (catches races)
        let timer = DispatchSource.makeTimerSource(queue: DispatchQueue.global(qos: .userInitiated))
        timer.schedule(deadline: .now() + 0.5, repeating: 0.5)
        timer.setEventHandler { [weak self] in
            self?.scanEvents()
        }
        timer.resume()
        pollTimer = timer

        // Initial scan
        scanEvents()
    }

    private func scanEvents() {
        let fm = FileManager.default
        guard let files = try? fm.contentsOfDirectory(at: eventsDir, includingPropertiesForKeys: nil) else {
            return
        }

        for file in files where file.pathExtension == "json" {
            guard let data = try? Data(contentsOf: file) else {
                try? fm.removeItem(at: file)
                continue
            }

            guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                try? fm.removeItem(at: file)
                continue
            }

            let sessionId = json["session_id"] as? String ?? "unknown"
            let cwd = json["cwd"] as? String ?? ""
            let repoName = json["repo_name"] as? String ?? "unknown"
            let branch = json["branch"] as? String ?? "unknown"
            let message = json["message"] as? String ?? ""
            let timestampStr = json["timestamp"] as? String ?? ""

            let formatter = ISO8601DateFormatter()
            let timestamp = formatter.date(from: timestampStr) ?? Date()

            let event = ApprovalEvent(
                sessionId: sessionId,
                cwd: cwd,
                repoName: repoName,
                branch: branch,
                message: message,
                timestamp: timestamp
            )

            // Only enqueue if not already in the queue
            if !queueManager.hasEvent(sessionId: sessionId) {
                queueManager.enqueue(event)
                notificationManager.fireNotification(for: event)
                NSLog("[cc-relay] Enqueued event for session: %@ (%@ %@)", sessionId, repoName, branch)
            }

            // Delete the event file (consumed)
            try? fm.removeItem(at: file)
        }
    }
}
