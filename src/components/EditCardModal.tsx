import { useState, useEffect } from 'react';
import type { Card } from '../entities/Card';
import Modal from './Modal';
import FormInput from './FormInput';
import ColorPicker from './ColorPicker';
import Button from './Button';

type CardColor = 'red' | 'blue' | 'green' | 'yellow' | 'purple' | 'gray';

interface EditCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  card: Card | null;
  onSubmit: (cardId: number, updates: { title?: string; description?: string; color?: string }) => Promise<void>;
  onDelete: (cardId: number) => void;
}

export default function EditCardModal({
  isOpen,
  onClose,
  card,
  onSubmit,
  onDelete
}: EditCardModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState<CardColor>('gray');
  const [titleError, setTitleError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (card) {
      setTitle(card.title);
      setDescription(card.description);
      setColor(card.color as CardColor);
    }
  }, [card]);

  const handleClose = () => {
    setTitleError('');
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!card) return;

    if (!title.trim()) {
      setTitleError('Title is required');
      return;
    }

    setIsSubmitting(true);
    setTitleError('');

    try {
      await onSubmit(card.id, {
        title: title.trim(),
        description: description.trim(),
        color
      });
      onClose();
    } catch (error) {
      console.error('Failed to update card:', error);
      setTitleError('Failed to update card. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = () => {
    if (card) {
      onDelete(card.id);
    }
  };

  if (!card) return null;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Edit Card" maxWidth="md">
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

        <div className="flex gap-3 justify-between mt-6">
          <Button
            variant="danger"
            onClick={handleDelete}
            disabled={isSubmitting}
          >
            Delete Card
          </Button>
          <div className="flex gap-3">
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
              Save Changes
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
