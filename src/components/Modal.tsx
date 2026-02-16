import { Dialog } from '@headlessui/react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg';
}

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 'md'
}: ModalProps) {
  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg'
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50" aria-hidden="true" />

      {/* Full-screen container to center the panel */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className={`${maxWidthClasses[maxWidth]} w-full bg-white rounded-lg shadow-xl`}>
          {/* Title */}
          <Dialog.Title className="text-lg font-semibold px-6 py-4 border-b border-gray-200">
            {title}
          </Dialog.Title>

          {/* Content */}
          <div className="px-6 py-4">
            {children}
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
