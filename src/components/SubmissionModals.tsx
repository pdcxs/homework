// components/SubmissionModals.tsx
import { Modal, Text, Group, Button, Alert, List } from '@mantine/core';
import { RunResult } from '@/lib/wandbox';

interface SubmissionModalsProps {
    noRunOpened: boolean;
    onNoRunClose: () => void;
    testWarningOpened: boolean;
    onTestWarningClose: () => void;
    submitting: boolean;
    runResult: RunResult | null;
    hasTestCases: boolean;
    onSubmit: () => void;
}

export function SubmissionModals({
    noRunOpened,
    onNoRunClose,
    testWarningOpened,
    onTestWarningClose,
    submitting,
    runResult,
    hasTestCases,
    onSubmit
}: SubmissionModalsProps) {
    return (
        <>
            {/* 确认提交模态框 */}
            <Modal opened={noRunOpened} onClose={onNoRunClose} title="确认提交" centered>
                <Text mb="md">您还没有运行代码，是否确认提交？</Text>
                <Group justify="flex-end">
                    <Button variant="subtle" onClick={onNoRunClose}>
                        取消
                    </Button>
                    <Button onClick={onSubmit} loading={submitting}>
                        确认提交
                    </Button>
                </Group>
            </Modal>

            {/* 测试未通过警告模态框 */}
            <Modal opened={testWarningOpened} onClose={onTestWarningClose} title="测试未全部通过" centered>
                {hasTestCases ? (
                    <>
                        <Alert color="orange" mb="md">
                            您的代码没有通过全部测试用例，是否确认提交？
                        </Alert>
                        <List size="sm" mb="md">
                            <List.Item>通过的测试用例: {runResult?.testResults?.filter(t => t.passed).length}</List.Item>
                            <List.Item>总测试用例: {runResult?.testResults?.length}</List.Item>
                        </List>
                    </>) :
                    <Text>"您还没有运行过代码，建议先运行代码确认无误后再提交。"</Text>}
                <Group justify="flex-end">
                    <Button variant="subtle" onClick={onTestWarningClose}>
                        继续修改
                    </Button>
                    <Button onClick={onSubmit} loading={submitting}>
                        确认提交
                    </Button>
                </Group>
            </Modal>
        </>
    );
}