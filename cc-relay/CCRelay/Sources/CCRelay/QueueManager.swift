import Foundation

final class QueueManager {
    static let shared = QueueManager()

    private let queue = DispatchQueue(label: "com.kevinhyde.cc-relay.queue")
    private var events: [ApprovalEvent] = []

    private init() {}

    var current: ApprovalEvent? {
        queue.sync { events.first }
    }

    var count: Int {
        queue.sync { events.count }
    }

    func hasEvent(sessionId: String) -> Bool {
        queue.sync { events.contains { $0.sessionId == sessionId } }
    }

    func enqueue(_ event: ApprovalEvent) {
        queue.sync { events.append(event) }
    }

    func respond(approval: Bool) {
        let event: ApprovalEvent? = queue.sync {
            guard !events.isEmpty else { return nil }
            return events.removeFirst()
        }

        guard let event = event else { return }

        // Write response to the named pipe
        let home = FileManager.default.homeDirectoryForCurrentUser
        let pipePath = home.appendingPathComponent(".cc-relay/pipes/\(event.sessionId)").path
        let response = approval ? "allow\n" : "block\n"

        DispatchQueue.global(qos: .userInitiated).async {
            guard let data = response.data(using: .utf8) else { return }

            // Open pipe for writing — blocks until the hook script reader is ready
            let fd = open(pipePath, O_WRONLY)
            guard fd >= 0 else {
                NSLog("[cc-relay] Could not open pipe for session %@: %s",
                      event.sessionId, strerror(errno))
                return
            }
            defer { close(fd) }

            data.withUnsafeBytes { ptr in
                guard let base = ptr.baseAddress else { return }
                _ = write(fd, base, data.count)
            }

            NSLog("[cc-relay] Sent '%@' to session %@",
                  approval ? "allow" : "block", event.sessionId)
        }
    }
}
