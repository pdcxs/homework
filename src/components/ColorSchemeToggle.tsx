// components/ColorSchemeToggle.tsx
import { Button, Tooltip, useMantineColorScheme } from '@mantine/core';
import { Sun, MoonStars } from 'tabler-icons-react';

export function ColorSchemeToggle() {
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();

  return (
    <Tooltip label={colorScheme === 'dark' ? '切换到浅色模式' : '切换到深色模式'} position="bottom">
      <Button p="5" variant='default' c="orange" onClick={toggleColorScheme}>
        {colorScheme === 'dark' ? <Sun size={24} /> : <MoonStars size={24} />}
      </Button>
    </Tooltip>
  );
}
