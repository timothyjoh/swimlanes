import { Dialog } from '@headlessui/react';
import { useState } from 'react';
import Button from './Button';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  danger = false
}: ConfirmDialogProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      await onConfirm();
      onClose();
    } catch (error) {
      console.error('Confirm action failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50" aria-hidden="true" />

      {/* Full-screen container to center the panel */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="max-w-md w-full bg-white rounded-lg shadow-xl">
          <div className="px-6 py-4">
            <Dialog.Title className="text-lg font-semibold mb-2">
              {title}
            </Dialog.Title>
            <Dialog.Description className="text-gray-600">
              {message}
            </Dialog.Description>
          </div>

          <div className="px-6 py-4 bg-gray-50 flex gap-3 justify-end rounded-b-lg">
            <Button
              variant="secondary"
              onClick={onClose}
              disabled={isLoading}
            >
              {cancelText}
            </Button>
            <Button
              variant={danger ? 'danger' : 'primary'}
              onClick={handleConfirm}
              loading={isLoading}
            >
              {confirmText}
            </Button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
