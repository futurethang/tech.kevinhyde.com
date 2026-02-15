/**
 * ConfirmDialog - Reusable confirmation dialog component
 * v5 Topps design: ink-bleed title, token colors
 */

import { Button, Card, CardContent } from './';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: 'primary' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
  disabled?: boolean;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmVariant = 'primary',
  onConfirm,
  onCancel,
  disabled = false
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <Card className="w-full max-w-md">
        <CardContent>
          <h3 className="text-lg font-display font-bold text-[var(--color-text-primary)] mb-3 ink-bleed">
            {title}
          </h3>

          <p className="text-[var(--color-text-secondary)] mb-6 leading-relaxed">
            {message}
          </p>

          <div className="flex gap-3">
            <Button
              variant="ghost"
              className="flex-1"
              onClick={onCancel}
              disabled={disabled}
            >
              {cancelText}
            </Button>
            <Button
              variant={confirmVariant}
              className="flex-1"
              onClick={onConfirm}
              disabled={disabled}
            >
              {confirmText}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
