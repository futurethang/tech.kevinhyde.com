/**
 * ConfirmDialog - Reusable confirmation dialog component
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

  const confirmButtonClass = confirmVariant === 'danger' 
    ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500' 
    : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <Card className="w-full max-w-md">
        <CardContent>
          <h3 className="text-lg font-display font-bold text-white mb-3">
            {title}
          </h3>
          
          <p className="text-gray-300 mb-6 leading-relaxed">
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
              className={`flex-1 ${confirmButtonClass}`}
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