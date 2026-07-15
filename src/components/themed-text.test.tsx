import { render, screen } from '@testing-library/react-native';

import { ThemedText } from '@/components/themed-text';

test('renders its children as text', async () => {
  await render(<ThemedText>Hello NoShot</ThemedText>);

  expect(screen.getByText('Hello NoShot')).toBeTruthy();
});
