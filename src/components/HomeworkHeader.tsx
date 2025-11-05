import { Button, Group, Title, Tooltip, ActionIcon, Select } from '@mantine/core';
import { IconArrowLeft, IconRefresh } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { LANGUAGE_OPTIONS } from '@/lib/wandbox';

interface HomeworkHeaderProps {
    title: string;
    language: string;
    onLanguageChange: (language: string) => void;
    onResetToOriginal: () => void;
    onResetToPreviousSubmission: () => void;
    hasPreviousSubmission: boolean;
    isLanguageEditable: boolean;
}

export function HomeworkHeader({
    title,
    language,
    onLanguageChange,
    onResetToOriginal,
    onResetToPreviousSubmission,
    hasPreviousSubmission,
    isLanguageEditable
}: HomeworkHeaderProps) {
    const navigate = useNavigate();

    return (
        <Group>
            <Button
                variant="subtle"
                leftSection={<IconArrowLeft size={16} />}
                onClick={() => navigate('/tasks')}
            >
                返回
            </Button>
            <Title order={3}>{title}</Title>

            <Group style={{ marginLeft: 'auto' }}>
                {/* 重置到原始文件按钮 */}
                <Tooltip label="重置到原始文件">
                    <ActionIcon
                        variant="light"
                        color="blue"
                        onClick={onResetToOriginal}
                        size="lg"
                    >
                        <IconRefresh size={18} />
                    </ActionIcon>
                </Tooltip>

                {/* 重置到之前提交按钮 */}
                {hasPreviousSubmission && (
                    <Tooltip label="重置到之前提交">
                        <ActionIcon
                            variant="light"
                            color="orange"
                            onClick={onResetToPreviousSubmission}
                            size="lg"
                        >
                            <IconRefresh size={18} />
                        </ActionIcon>
                    </Tooltip>
                )}

                <Select
                    data={LANGUAGE_OPTIONS}
                    value={language}
                    defaultValue={""}
                    onChange={(value) => onLanguageChange(value || '')}
                    disabled={!isLanguageEditable}
                />
            </Group>
        </Group>
    );
}