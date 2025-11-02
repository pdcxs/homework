import { Button, useMantineColorScheme } from '@mantine/core';
import { Sun, MoonStars } from 'tabler-icons-react';

export function ColorSchemeToggle() {
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();

  return (
    <Button variant='subtle' c="orange" onClick={toggleColorScheme}>
      {colorScheme === 'dark' ? <Sun size={16} /> : <MoonStars size={16} />}
    </Button>
  );
}
