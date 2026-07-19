import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';

type PollCreateFormProps = {
  onSubmit: (input: { question: string; options: string[]; allowMultiple: boolean }) => void;
  disabled?: boolean;
};

export function PollCreateForm({ onSubmit, disabled }: PollCreateFormProps) {
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
    <View style={styles.form}>
      <TextField
        label="New poll question"
        placeholder="e.g. Who wins?"
        value={question}
        onChangeText={setQuestion}
      />
      {options.map((option, index) => (
        <TextField
          key={index}
          label={`Option ${index + 1}`}
          placeholder="Option"
          value={option}
          onChangeText={(text) =>
            setOptions((prev) => prev.map((o, i) => (i === index ? text : o)))
          }
        />
      ))}
      <Button variant="ghost" onPress={() => setOptions((prev) => [...prev, ''])}>
        + Add option
      </Button>
      <Button
        variant={allowMultiple ? 'accent' : 'muted'}
        onPress={() => setAllowMultiple((v) => !v)}
      >
        {allowMultiple ? 'Multiple choices allowed' : 'Single choice only'}
      </Button>
      <Button variant="primary" onPress={handleSubmit} disabled={!canSubmit || disabled}>
        Create poll
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: Spacing.two,
  },
});
