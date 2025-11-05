import {
    Paper,
    Stack,
    Group,
    Title,
    Text,
    Code,
    Button,
    Alert,
    List,
    ThemeIcon
} from '@mantine/core';
import { IconRun, IconSend, IconCheck, IconX } from '@tabler/icons-react';
import { RunResult } from '@/lib/wandbox';

interface RunResultPanelProps {
    runResult: RunResult | null;
    running: boolean;
    submitting: boolean;
    hasPreviousSubmission: boolean;
    onRunCode: () => void;
    onSubmit: () => void;
}

export function RunResultPanel({
    runResult,
    running,
    submitting,
    hasPreviousSubmission,
    onRunCode,
    onSubmit
}: RunResultPanelProps) {
    return (
        <Paper p="md">
            <Stack>
                <Title order={4}>运行结果</Title>

                {runResult && (
                    <Paper p="md" withBorder>
                        <Group mb="sm">
                            <Text fw={500} color={runResult.success ? 'green' : 'red'}>
                                {runResult.success ? '运行成功' : '运行失败'}
                            </Text>
                            {runResult.status && (
                                <Text size="sm" c="dimmed">
                                    状态码: {runResult.status}
                                </Text>
                            )}
                            {runResult.allTestsPassed !== undefined && (
                                <Alert 
                                    color={runResult.allTestsPassed ? 'green' : 'orange'}
                                    variant="light"
                                    p="xs"
                                >
                                    {runResult.allTestsPassed ? '全部测试通过' : '部分测试未通过'}
                                </Alert>
                            )}
                        </Group>
                        
                        {/* 测试用例结果 */}
                        {runResult.testResults && (
                            <div>
                                <Text fw={500} size="sm" mb="xs">测试用例结果:</Text>
                                <Stack gap="xs">
                                    {runResult.testResults.map((test, index) => (
                                        <Paper key={index} p="sm" withBorder>
                                            <Group>
                                                <ThemeIcon 
                                                    color={test.passed ? 'green' : 'red'} 
                                                    size="sm"
                                                >
                                                    {test.passed ? <IconCheck size={14} /> : <IconX size={14} />}
                                                </ThemeIcon>
                                                <Text size="sm">
                                                    测试用例 {index + 1}: {test.passed ? '通过' : '失败'}
                                                </Text>
                                            </Group>
                                        </Paper>
                                    ))}
                                </Stack>
                            </div>
                        )}
                        
                        {runResult.output && (
                            <div>
                                <Text fw={500} size="sm" mb="xs">输出:</Text>
                                <Code block style={{ whiteSpace: 'pre-wrap', maxHeight: '200px', overflow: 'auto' }}>
                                    {runResult.output}
                                </Code>
                            </div>
                        )}
                        {runResult.error && (
                            <div>
                                <Text fw={500} size="sm" color="red" mb="xs">错误信息:</Text>
                                <Code block color="red" style={{ whiteSpace: 'pre-wrap', maxHeight: '200px', overflow: 'auto' }}>
                                    {runResult.error}
                                </Code>
                            </div>
                        )}
                    </Paper>
                )}

                <Group justify="flex-end">
                    <Button
                        leftSection={<IconRun size={16} />}
                        onClick={onRunCode}
                        loading={running}
                        variant="light"
                    >
                        运行代码
                    </Button>
                    <Button
                        leftSection={<IconSend size={16} />}
                        onClick={onSubmit}
                        loading={submitting}
                        disabled={running}
                    >
                        {hasPreviousSubmission ? '更新提交' : '提交作业'}
                    </Button>
                </Group>
            </Stack>
        </Paper>
    );
}