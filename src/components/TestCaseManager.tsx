// components/TestCaseManager.tsx
import React, { useState, useEffect } from 'react';
import {
    Paper,
    Title,
    Button,
    Stack,
    Group,
    Textarea,
    ActionIcon,
    Text,
    Grid,
} from '@mantine/core';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { useAuth } from '@/App';

interface TestCase {
    input: string;
    output: string;
}

interface TestCaseManagerProps {
    homeworkId: string;
}

export function TestCaseManager({ homeworkId }: TestCaseManagerProps) {
    const { supabaseClient: supabase } = useAuth();
    const [testCases, setTestCases] = useState<TestCase[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchTestCases();
    }, [homeworkId]);

    const fetchTestCases = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('homeworks')
                .select('inputs, outputs')
                .eq('id', homeworkId)
                .single();

            if (error) throw error;

            if (data.inputs && data.outputs) {
                const cases: TestCase[] = data.inputs.map((input: string, index: number) => ({
                    input,
                    output: data.outputs[index] || '',
                }));
                setTestCases(cases);
            } else {
                setTestCases([]);
            }
        } catch (err: any) {
            console.error('获取测试用例失败:', err);
            setTestCases([]);
        } finally {
            setLoading(false);
        }
    };

    const handleAddTestCase = () => {
        setTestCases([...testCases, { input: '', output: '' }]);
    };

    const handleTestCaseChange = (index: number, field: 'input' | 'output', value: string) => {
        const newTestCases = [...testCases];
        newTestCases[index][field] = value;
        setTestCases(newTestCases);
    };

    const handleDeleteTestCase = (index: number) => {
        const newTestCases = testCases.filter((_, i) => i !== index);
        setTestCases(newTestCases);
    };

    const saveTestCases = async () => {
        try {
            setSaving(true);
            const inputs = testCases.map(tc => tc.input);
            const outputs = testCases.map(tc => tc.output);

            const { error } = await supabase
                .from('homeworks')
                .update({
                    inputs,
                    outputs,
                })
                .eq('id', homeworkId);

            if (error) throw error;

            // 可以添加成功提示
        } catch (err: any) {
            console.error('保存测试用例失败:', err);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Stack p="xl">
            <Group justify="space-between">
                <Title order={3}>测试用例管理</Title>
                <Group>
                    <Button
                        leftSection={<IconPlus size={16} />}
                        onClick={handleAddTestCase}
                        variant="outline"
                    >
                        添加测试用例
                    </Button>
                    <Button onClick={saveTestCases} loading={saving}>
                        保存测试用例
                    </Button>
                </Group>
            </Group>

            {testCases.length === 0 ? (
                <Paper p="xl" withBorder>
                    <Text color="dimmed" ta="center">
                        暂无测试用例，点击"添加测试用例"来创建
                    </Text>
                </Paper>
            ) : (
                <Stack>
                    {testCases.map((testCase, index) => (
                        <Paper key={index} p="md" withBorder>
                            <Grid>
                                <Grid.Col span={5}>
                                    <Textarea
                                        label={`输入 #${index + 1}`}
                                        value={testCase.input}
                                        onChange={(e) => handleTestCaseChange(index, 'input', e.target.value)}
                                        placeholder="输入测试用例..."
                                        minRows={3}
                                    />
                                </Grid.Col>
                                <Grid.Col span={5}>
                                    <Textarea
                                        label={`期望输出 #${index + 1}`}
                                        value={testCase.output}
                                        onChange={(e) => handleTestCaseChange(index, 'output', e.target.value)}
                                        placeholder="输入期望输出..."
                                        minRows={3}
                                    />
                                </Grid.Col>
                                <Grid.Col span={2}>
                                    <ActionIcon
                                        color="red"
                                        onClick={() => handleDeleteTestCase(index)}
                                        style={{ marginTop: '24px' }}
                                    >
                                        <IconTrash size={16} />
                                    </ActionIcon>
                                </Grid.Col>
                            </Grid>
                        </Paper>
                    ))}
                </Stack>
            )}

            {testCases.length > 0 && (
                <Group justify="flex-end">
                    <Button onClick={saveTestCases} loading={saving}>
                        保存所有测试用例
                    </Button>
                </Group>
            )}
        </Stack>
    );
}