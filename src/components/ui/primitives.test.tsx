import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CurrencyCategoryColors } from '@/constants/theme';

test('Button renders its label', async () => {
  await render(<Button onPress={() => {}}>Confirm</Button>);

  expect(screen.getByText('Confirm')).toBeTruthy();
});

test('Card renders its children', async () => {
  await render(
    <Card>
      <Text>Card content</Text>
    </Card>,
  );

  expect(screen.getByText('Card content')).toBeTruthy();
});

test('Badge renders its label', async () => {
  await render(<Badge label="Food" color={CurrencyCategoryColors.food} />);

  expect(screen.getByText('Food')).toBeTruthy();
});
