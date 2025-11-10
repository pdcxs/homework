// components/CodeEditorTabs.tsx
import { useState } from 'react';
import {
    Tabs,
    Group,
    Text,
    CloseButton,
    TextInput,
    Button,
    Tooltip,
} from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import CodeEditor from '@/components/CodeEditor';
import { HomeworkFile } from '@/lib/database';

export interface CustomFile {
    id: string;
    file_name: string;
    file_content: string;
    editable: boolean;
    isCustom: boolean;
}

interface CodeEditorTabsProps {
    files: (CustomFile | HomeworkFile)[];
    fileContents: Record<string, string>;
    activeFile: string | null;
    language: string;
    onFileChange: (fileName: string, content: string) => void;
    onActiveFileChange: (fileName: string | null) => void;
    onAddFile: () => void;
    onDeleteFile: (fileName: string) => void;
    onFileNameEdit: (oldFileName: string, newFileName: string) => void;
}

export function CodeEditorTabs({
    files,
    fileContents,
    activeFile,
    language,
    onFileChange,
    onActiveFileChange,
    onAddFile,
    onDeleteFile,
    onFileNameEdit
}: CodeEditorTabsProps) {
    const [editingFileName, setEditingFileName] = useState<string | null>(null);
    const [tempFileName, setTempFileName] = useState<string>('');

    const handleStartEditFileName = (fileName: string) => {
        const file = files.find(f => f.file_name === fileName);
        if (file && file.editable) {
            setEditingFileName(fileName);
            setTempFileName(fileName);
        }
    };

    const handleFinishEditFileName = () => {
        if (!editingFileName || !tempFileName) return;

        // 检查文件名是否已存在
        if (files.some(f => f.file_name === tempFileName && f.file_name !== editingFileName)) {
            alert('文件名已存在');
            return;
        }

        onFileNameEdit(editingFileName, tempFileName);
        setEditingFileName(null);
        setTempFileName('');
    };

    const handleCancelEditFileName = () => {
        setEditingFileName(null);
        setTempFileName('');
    };

    if (files.length === 0) {
        return (
            <Group>
                <Text c="dimmed">暂无文件</Text>
                <Button
                    leftSection={<IconPlus size={16} />}
                    variant="light"
                    size="sm"
                    onClick={onAddFile}
                >
                </Button>
            </Group>
        );
    }

    return (
        <Tabs value={activeFile} onChange={onActiveFileChange}>
            <Tabs.List>
                {files.map(file => (
                    <Tabs.Tab
                        key={file.id}
                        value={file.file_name}
                        onDoubleClick={() => handleStartEditFileName(file.file_name)}
                    >
                        <Group gap="xs">
                            {editingFileName === file.file_name ? (
                                <TextInput
                                    value={tempFileName}
                                    onChange={(e) => setTempFileName(e.currentTarget.value)}
                                    onBlur={handleFinishEditFileName}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleFinishEditFileName();
                                        if (e.key === 'Escape') handleCancelEditFileName();
                                    }}
                                    size="xs"
                                    style={{ width: '120px' }}
                                    autoFocus
                                />
                            ) : (
                                <Text size="sm">{file.file_name}</Text>
                            )}
                            {!file.editable && (
                                <Text component="span" c="dimmed" size="xs">
                                    (只读)
                                </Text>
                            )}
                            {file.editable && editingFileName !== file.file_name && (
                                <CloseButton
                                    size="xs"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDeleteFile(file.file_name);
                                    }}
                                    style={{ marginLeft: '4px' }}
                                />
                            )}
                        </Group>
                    </Tabs.Tab>
                ))}
                <Tooltip label="添加新文件">
                    <Button
                        variant="subtle"
                        onClick={onAddFile}
                        m={0}
                        p={0}
                    >
                        <IconPlus size={16} />
                    </Button>
                </Tooltip>
            </Tabs.List>

            {files.map(file => (
                <Tabs.Panel key={file.id} value={file.file_name}>
                    <CodeEditor
                        value={fileContents[file.file_name] || ''}
                        onChange={(value) => onFileChange(file.file_name, value || '')}
                        language={language}
                        readOnly={!file.editable}
                        height="400px"
                    />
                </Tabs.Panel>
            ))}
        </Tabs>
    );
}