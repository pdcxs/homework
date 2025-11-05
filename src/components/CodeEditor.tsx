// CodeEditor
import Editor from '@monaco-editor/react';
import { MantineColorScheme } from '@mantine/core';

interface CodeEditorProps {
  value: string;
  onChange: (value: string | undefined) => void;
  language: string;
  readOnly?: boolean;
  height?: string;
  colorScheme?: MantineColorScheme;
}

export default function CodeEditor({
  value,
  onChange,
  language,
  readOnly = false,
  height = '400px',
  colorScheme = 'light',
}: CodeEditorProps) {
  const editorLanguageMap: Record<string, string> = {
    cpp: 'cpp',
    java: 'java',
    python: 'python',
    csharp: 'csharp',
    go: 'go',
    haskell: 'haskell',
    list: 'lisp',
  };

  return (
    <Editor
      height={height}
      language={editorLanguageMap[language] || 'plaintext'}
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

