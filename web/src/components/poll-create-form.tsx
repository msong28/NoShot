import { useState } from 'react';

export function PollCreateForm({
  onSubmit,
  disabled,
}: {
  onSubmit: (input: { question: string; options: string[]; allowMultiple: boolean }) => void;
  disabled?: boolean;
}) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [allowMultiple, setAllowMultiple] = useState(false);

  const canSubmit = question.trim().length > 0 && options.filter((o) => o.trim()).length >= 2;

  function handleSubmit() {
    onSubmit({
      question,
      options: options.map((o) => o.trim()).filter((o) => o.length > 0),
      allowMultiple,
    });
    setQuestion('');
    setOptions(['', '']);
    setAllowMultiple(false);
  }

  return (
    <div className="flex flex-col gap-two rounded-large bg-surface-sunken p-three">
      <input
        placeholder="New poll question"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        className="rounded-medium bg-surface p-two"
      />
      {options.map((option, index) => (
        <input
          key={index}
          placeholder={`Option ${index + 1}`}
          value={option}
          onChange={(e) =>
            setOptions((prev) => prev.map((o, i) => (i === index ? e.target.value : o)))
          }
          className="rounded-medium bg-surface p-two"
        />
      ))}
      <button
        type="button"
        onClick={() => setOptions((prev) => [...prev, ''])}
        className="self-start text-sm font-bold text-secondary"
      >
        + Add option
      </button>
      <button
        type="button"
        onClick={() => setAllowMultiple((v) => !v)}
        className={`self-start rounded-pill px-three py-one font-display text-sm font-bold ${
          allowMultiple ? 'bg-secondary text-on-secondary' : 'bg-surface text-text-secondary'
        }`}
      >
        {allowMultiple ? 'Multiple choices allowed' : 'Single choice only'}
      </button>
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!canSubmit || disabled}
        className="rounded-pill bg-primary px-three py-two font-display font-bold text-on-primary disabled:opacity-60"
      >
        Create poll
      </button>
    </div>
  );
}
