import { ThemedText } from '@/components/themed-text';
import { render, screen } from '@/test/render';

test('renders its children as text', async () => {
  await render(<ThemedText>Hello NoShot</ThemedText>);

  expect(screen.getByText('Hello NoShot')).toBeTruthy();
});
