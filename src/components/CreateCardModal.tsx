import { useState } from 'react';
import Modal from './Modal';
import FormInput from './FormInput';
import ColorPicker from './ColorPicker';
import Button from './Button';

type CardColor = 'red' | 'blue' | 'green' | 'yellow' | 'purple' | 'gray';

interface CreateCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  columnId: number;
  onSubmit: (columnId: number, data: { title: string; description: string; color: string }) => Promise<void>;
}

export default function CreateCardModal({
  isOpen,
  onClose,
  columnId,
  onSubmit
}: CreateCardModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState<CardColor>('gray');
  const [titleError, setTitleError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setColor('gray');
    setTitleError('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      setTitleError('Title is required');
      return;
    }

    setIsSubmitting(true);
    setTitleError('');

    try {
      await onSubmit(columnId, {
        title: title.trim(),
        description: description.trim(),
        color
      });
      resetForm();
      onClose();
    } catch (error) {
      console.error('Failed to create card:', error);
      setTitleError('Failed to create card. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Create Card" maxWidth="md">
      <form onSubmit={handleSubmit}>
        <FormInput
          label="Title"
          value={title}
          onChange={setTitle}
          placeholder="Enter card title"
          required={true}
          error={titleError}
          autoFocus={true}
        />

        <FormInput
          label="Description"
          value={description}
          onChange={setDescription}
          placeholder="Enter description (optional)"
          type="textarea"
          rows={4}
        />

        <ColorPicker selectedColor={color} onChange={setColor} />

        <div className="flex gap-3 justify-end mt-6">
          <Button
            variant="secondary"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={isSubmitting}
          >
            Create Card
          </Button>
        </div>
      </form>
    </Modal>
  );
}
