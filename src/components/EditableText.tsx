import { useState, useEffect, useRef } from 'react';

interface EditableTextProps {
  value: string;
  onSave: (newValue: string) => Promise<void>;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
}

export default function EditableText({
  value,
  onSave,
  placeholder = '',
  className = '',
  inputClassName = ''
}: EditableTextProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  const handleSave = async () => {
    const trimmedValue = editValue.trim();
    if (!trimmedValue) {
      setError('This field cannot be empty');
      return;
    }

    if (trimmedValue === value) {
      setIsEditing(false);
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await onSave(trimmedValue);
      setIsEditing(false);
    } catch (err) {
      setError('Failed to save. Please try again.');
      console.error('Save failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setEditValue(value);
    setError('');
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <div>
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          placeholder={placeholder}
          className={`
            px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500
            ${error ? 'border-red-500' : 'border-gray-300'}
            ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
            ${inputClassName}
          `}
        />
        {error && (
          <p className="text-sm text-red-500 mt-1">{error}</p>
        )}
      </div>
    );
  }

  return (
    <div
      onClick={() => setIsEditing(true)}
      className={`cursor-pointer hover:underline ${className}`}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setIsEditing(true);
        }
      }}
      aria-label="Click to edit"
    >
      {value || placeholder}
    </div>
  );
}
