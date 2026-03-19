import AppKit

final class OverlayWindow: NSPanel {
    private let queueManager: QueueManager
    private let contentBox: NSView
    private let contextLabel: NSTextField
    private let messageLabel: NSTextField
    private let hintLabel: NSTextField
    private let badgeLabel: NSTextField

    init(queueManager: QueueManager) {
        self.queueManager = queueManager

        // Create content views before calling super.init
        contentBox = NSView(frame: NSRect(x: 0, y: 0, width: 480, height: 160))

        contextLabel = NSTextField(labelWithString: "")
        contextLabel.font = NSFont.systemFont(ofSize: 12, weight: .regular)
        contextLabel.textColor = NSColor.secondaryLabelColor
        contextLabel.maximumNumberOfLines = 1
        contextLabel.lineBreakMode = .byTruncatingTail

        messageLabel = NSTextField(labelWithString: "")
        messageLabel.font = NSFont.systemFont(ofSize: 15, weight: .medium)
        messageLabel.textColor = NSColor.labelColor
        messageLabel.maximumNumberOfLines = 3
        messageLabel.lineBreakMode = .byTruncatingTail

        hintLabel = NSTextField(labelWithString: "[Y] approve  [N] block  [Esc] dismiss")
        hintLabel.font = NSFont.monospacedSystemFont(ofSize: 11, weight: .regular)
        hintLabel.textColor = NSColor.tertiaryLabelColor
        hintLabel.alignment = .center

        badgeLabel = NSTextField(labelWithString: "")
        badgeLabel.font = NSFont.systemFont(ofSize: 11, weight: .semibold)
        badgeLabel.textColor = NSColor.secondaryLabelColor
        badgeLabel.alignment = .right
        badgeLabel.isHidden = true

        super.init(
            contentRect: NSRect(x: 0, y: 0, width: 480, height: 160),
            styleMask: [.borderless, .nonactivatingPanel],
            backing: .buffered,
            defer: false
        )

        self.level = .floating
        self.isMovableByWindowBackground = true
        self.backgroundColor = NSColor.windowBackgroundColor.withAlphaComponent(0.96)
        self.isOpaque = false
        self.hasShadow = true
        self.hidesOnDeactivate = false
        self.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        self.isFloatingPanel = true

        // Round corners
        self.contentView?.wantsLayer = true
        self.contentView?.layer?.cornerRadius = 12
        self.contentView?.layer?.masksToBounds = true

        setupLayout()
    }

    private func setupLayout() {
        guard let container = self.contentView else { return }

        for view in [contextLabel, messageLabel, hintLabel, badgeLabel] {
            view.translatesAutoresizingMaskIntoConstraints = false
            container.addSubview(view)
        }

        NSLayoutConstraint.activate([
            contextLabel.topAnchor.constraint(equalTo: container.topAnchor, constant: 20),
            contextLabel.leadingAnchor.constraint(equalTo: container.leadingAnchor, constant: 24),
            contextLabel.trailingAnchor.constraint(equalTo: container.trailingAnchor, constant: -24),

            messageLabel.topAnchor.constraint(equalTo: contextLabel.bottomAnchor, constant: 8),
            messageLabel.leadingAnchor.constraint(equalTo: container.leadingAnchor, constant: 24),
            messageLabel.trailingAnchor.constraint(equalTo: container.trailingAnchor, constant: -24),

            hintLabel.bottomAnchor.constraint(equalTo: container.bottomAnchor, constant: -16),
            hintLabel.leadingAnchor.constraint(equalTo: container.leadingAnchor, constant: 24),
            hintLabel.trailingAnchor.constraint(equalTo: container.trailingAnchor, constant: -24),

            badgeLabel.topAnchor.constraint(equalTo: container.topAnchor, constant: 16),
            badgeLabel.trailingAnchor.constraint(equalTo: container.trailingAnchor, constant: -20),
        ])
    }

    func showWithCurrentEvent() {
        guard let event = queueManager.current else { return }

        contextLabel.stringValue = "\(event.repoName) (\(event.branch))"

        let msg = event.message
        messageLabel.stringValue = msg.count > 120 ? String(msg.prefix(120)) + "…" : msg

        let pending = queueManager.count
        if pending > 1 {
            badgeLabel.stringValue = "+\(pending - 1) more waiting"
            badgeLabel.isHidden = false
        } else {
            badgeLabel.isHidden = true
        }

        // Center on the active screen
        if let screen = NSScreen.main {
            let screenFrame = screen.visibleFrame
            let x = screenFrame.midX - frame.width / 2
            let y = screenFrame.midY - frame.height / 2 + screenFrame.height * 0.2
            setFrameOrigin(NSPoint(x: x, y: y))
        }

        self.orderFrontRegardless()
        self.makeKey()
    }

    override var canBecomeKey: Bool { true }

    override func keyDown(with event: NSEvent) {
        guard let chars = event.charactersIgnoringModifiers?.lowercased() else {
            super.keyDown(with: event)
            return
        }

        switch chars {
        case "y":
            queueManager.respond(approval: true)
            dismiss()
        case "\r":  // Return key
            queueManager.respond(approval: true)
            dismiss()
        case "n":
            queueManager.respond(approval: false)
            dismiss()
        case "\u{1b}":  // Escape
            queueManager.respond(approval: false)
            dismiss()
        default:
            super.keyDown(with: event)
        }
    }

    private func dismiss() {
        self.orderOut(nil)

        // If there are more events, show the next one after a brief delay
        if queueManager.current != nil {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { [weak self] in
                self?.showWithCurrentEvent()
            }
        }
    }
}
