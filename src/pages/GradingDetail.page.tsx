// pages/GradingDetail.page.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Table,
    Button,
    Paper,
    Title,
    Container,
    Text,
    Badge,
    Flex,
    Stack,
    LoadingOverlay,
    Group
} from '@mantine/core';
import { IconArrowLeft, IconCheck, IconX, IconEdit } from '@tabler/icons-react';
import { useAuth } from '@/App';

interface Submission {
    id: number;
    student_id: string;
    student_name: string;
    student_id_number: string;
    submitted_at: string;
    has_check: boolean;
    grade?: string;
    storage_path: string;
}

const GradingDetailPage: React.FC = () => {
    const { homeworkId } = useParams();
    const navigate = useNavigate();
    const { supabaseClient, userRole } = useAuth();
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [homeworkTitle, setHomeworkTitle] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (userRole === 'teacher' && homeworkId) {
            fetchSubmissions();
        }
    }, [userRole, homeworkId]);

    const fetchSubmissions = async () => {
        try {
            setLoading(true);

            // 获取作业信息
            const { data: homework, error: homeworkError } = await supabaseClient
                .from('homeworks')
                .select('title')
                .eq('id', homeworkId)
                .single();

            if (homeworkError) throw homeworkError;
            setHomeworkTitle(homework.title);

            // 使用 RPC 函数获取数据
            const { data: answers, error: answersError } = await supabaseClient
                .rpc('get_teacher_submissions', { homework_id: parseInt(homeworkId!) });

            if (answersError) throw answersError;

            console.log('RPC 返回数据:', answers);

            // 修复映射逻辑
            const submissionData: Submission[] = answers.map((answer: any) => {
                // 确保 has_check 是布尔值
                const hasCheck = Boolean(answer.has_check);

                console.log(`学生 ${answer.student_name}: has_check = ${answer.has_check}, 转换为 = ${hasCheck}`);

                return {
                    id: answer.answer_id,
                    student_id: answer.student_id,
                    student_name: answer.student_name,
                    student_id_number: answer.student_id_number,
                    submitted_at: answer.submitted_at,
                    has_check: hasCheck,
                    grade: answer.check_grade,
                    storage_path: answer.storage_path
                };
            });

            console.log('最终提交数据:', submissionData);
            setSubmissions(submissionData);
        } catch (err: any) {
            console.error('获取提交记录失败:', err);
            setError(`获取提交记录失败: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    // 添加调试信息到渲染中
    const renderSubmissions = () => {
        if (submissions.length === 0) {
            return (
                <Table.Tr>
                    <Table.Td colSpan={6} style={{ textAlign: 'center', padding: '2rem' }}>
                        <Text c="dimmed">
                            {loading ? '加载中...' : '暂无学生提交'}
                        </Text>
                    </Table.Td>
                </Table.Tr>
            );
        }

        return submissions.map((submission) => {
            console.log(`渲染学生 ${submission.student_name}: has_check = ${submission.has_check}`);

            return (
                <Table.Tr key={submission.id}>
                    <Table.Td>
                        <Text fw={500}>{submission.student_name}</Text>
                    </Table.Td>
                    <Table.Td>
                        <Text>{submission.student_id_number}</Text>
                    </Table.Td>
                    <Table.Td>
                        <Text size="sm">
                            {new Date(submission.submitted_at).toLocaleString('zh-CN')}
                        </Text>
                    </Table.Td>
                    <Table.Td>
                        <Badge
                            color={submission.has_check ? 'green' : 'orange'}
                            leftSection={submission.has_check ? <IconCheck size={12} /> : <IconX size={12} />}
                        >
                            {submission.has_check ? '已批改' : '未批改'}
                        </Badge>
                    </Table.Td>
                    <Table.Td>
                        <Text>
                            {submission.grade || '-'}
                        </Text>
                    </Table.Td>
                    <Table.Td>
                        <Button
                            leftSection={<IconEdit size={16} />}
                            variant="light"
                            onClick={() => navigate(`/grading/check/${submission.id}`)}
                        >
                            {submission.has_check ? '重新批改' : '开始批改'}
                        </Button>
                    </Table.Td>
                </Table.Tr>
            );
        });
    };

    if (userRole !== 'teacher') {
        return (
            <Container size="lg" py="xl">
                <Paper p="xl" withBorder>
                    <Text style={{ textAlign: 'center', fontWeight: 'bold' }} size="xl">
                        无访问权限
                    </Text>
                    <Text style={{ textAlign: 'center' }} color="dimmed" mt="md">
                        只有教师可以访问作业批改页面
                    </Text>
                </Paper>
            </Container>
        );
    }

    return (
        <Container size="lg" py="xl">
            <Stack gap="xl">
                <Flex justify="space-between" align="center">
                    <Group>
                        <Button
                            variant="subtle"
                            leftSection={<IconArrowLeft size={16} />}
                            onClick={() => navigate('/grading')}
                        >
                            返回
                        </Button>
                        <div>
                            <Title order={1}>{homeworkTitle}</Title>
                            <Text color="dimmed">学生提交记录</Text>
                        </div>
                    </Group>
                    <Text color="dimmed">
                        共 {submissions.length} 份提交
                    </Text>
                </Flex>

                {error && (
                    <Paper p="md" withBorder bg="red.0">
                        <Text color="red">{error}</Text>
                    </Paper>
                )}

                <Paper withBorder pos="relative">
                    <LoadingOverlay visible={loading} />
                    <Table>
                        <Table.Thead>
                            <Table.Tr>
                                <Table.Th>姓名</Table.Th>
                                <Table.Th>学号</Table.Th>
                                <Table.Th>提交时间</Table.Th>
                                <Table.Th>批改状态</Table.Th>
                                <Table.Th>批改结果</Table.Th>
                                <Table.Th>操作</Table.Th>
                            </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                            {renderSubmissions()}
                        </Table.Tbody>
                    </Table>
                </Paper>
            </Stack>
        </Container>
    );
};

export default GradingDetailPage;