// components/CodeEditor.tsx
import Editor from '@monaco-editor/react';
import { useMantineColorScheme } from '@mantine/core';

interface CodeEditorProps {
  value: string;
  onChange: (value: string | undefined) => void;
  language: string;
  readOnly?: boolean;
  height?: string;
}

export default function CodeEditor({
  value,
  onChange,
  language,
  readOnly = false,
  height = '400px',
}: CodeEditorProps) {
  const { colorScheme } = useMantineColorScheme();

  return (
    <Editor
      height={height}
      language={language}
      value={value}
      onChange={onChange}
      width="100%"
      options={{
        readOnly,
        minimap: { enabled: false },
        fontSize: 14,
        wordWrap: 'on',
        automaticLayout: true,
        scrollBeyondLastLine: false,
      }}
      theme={colorScheme === 'dark' ? 'vs-dark' : 'vs'}
    />
  );
}

