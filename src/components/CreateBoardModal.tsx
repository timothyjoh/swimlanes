import { useState } from 'react';
import Modal from './Modal';
import FormInput from './FormInput';
import Button from './Button';

interface CreateBoardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void>;
}

export default function CreateBoardModal({ isOpen, onClose, onSubmit }: CreateBoardModalProps) {
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setName('');
    setNameError('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setNameError('Board name is required');
      return;
    }

    setIsSubmitting(true);
    setNameError('');

    try {
      await onSubmit(name.trim());
      resetForm();
      onClose();
    } catch (error) {
      console.error('Failed to create board:', error);
      setNameError('Failed to create board. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Create Board" maxWidth="sm">
      <form onSubmit={handleSubmit}>
        <FormInput
          label="Board Name"
          value={name}
          onChange={setName}
          placeholder="Enter board name"
          required={true}
          error={nameError}
          autoFocus={true}
        />

        <div className="flex gap-3 justify-end mt-6">
          <Button variant="secondary" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={isSubmitting}>
            Create Board
          </Button>
        </div>
      </form>
    </Modal>
  );
}
