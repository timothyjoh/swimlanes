interface FormInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
  autoFocus?: boolean;
  type?: 'text' | 'textarea';
  rows?: number;
}

export default function FormInput({
  label,
  value,
  onChange,
  placeholder = '',
  required = false,
  error = '',
  autoFocus = false,
  type = 'text',
  rows = 4
}: FormInputProps) {
  const baseInputClasses = 'w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500';
  const errorClasses = error ? 'border-red-500' : 'border-gray-300';

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      {type === 'textarea' ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          autoFocus={autoFocus}
          rows={rows}
          className={`${baseInputClasses} ${errorClasses} resize-none`}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          autoFocus={autoFocus}
          className={`${baseInputClasses} ${errorClasses}`}
        />
      )}

      {error && (
        <p className="mt-1 text-sm text-red-500">{error}</p>
      )}
    </div>
  );
}
