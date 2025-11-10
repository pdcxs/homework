// pages/Grading.page.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
    Group,
    Progress
} from '@mantine/core';
import { IconEye, IconCalendar, IconUsers } from '@tabler/icons-react';
import { useAuth } from '@/App';

interface HomeworkWithStats {
    id: number;
    title: string;
    course_name: string;
    deadline: string;
    published: boolean;
    submitted_count: number;
    total_students: number;
    course_id: number;
}

const GradingPage: React.FC = () => {
    const { supabaseClient, userRole } = useAuth();
    const navigate = useNavigate();
    const [homeworks, setHomeworks] = useState<HomeworkWithStats[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (userRole === 'teacher') {
            fetchHomeworksWithStats();
        }
    }, [userRole]);

    const fetchHomeworksWithStats = async () => {
        try {
            setLoading(true);

            // 获取教师的所有课程
            const { data: courses, error: coursesError } = await supabaseClient
                .rpc('get_teacher_courses');

            if (coursesError) throw coursesError;

            const courseIds = courses.map((c: any) => c.id);

            if (courseIds.length === 0) {
                setHomeworks([]);
                return;
            }

            // 获取这些课程的作业
            const { data: homeworksData, error: homeworksError } = await supabaseClient
                .from('homeworks')
                .select('*')
                .in('course_id', courseIds)
                .order('created_at', { ascending: false });

            if (homeworksError) throw homeworksError;

            // 获取每个作业的统计信息
            const homeworksWithStats = await Promise.all(
                homeworksData.map(async (homework) => {
                    // 获取提交数量
                    const { count: submittedCount, error: countError } = await supabaseClient
                        .from('answers')
                        .select('*', { count: 'exact', head: true })
                        .eq('homework_id', homework.id);

                    if (countError) throw countError;

                    // 获取课程对应的总学生数
                    const { data: courseData, error: courseError } = await supabaseClient
                        .from('courses')
                        .select('class_ids, name')
                        .eq('id', homework.course_id)
                        .single();

                    if (courseError) throw courseError;

                    let totalStudents = 0;
                    if (courseData.class_ids && courseData.class_ids.length > 0) {
                        const { count: studentsCount, error: studentsError } = await supabaseClient
                            .from('profiles')
                            .select('*', { count: 'exact', head: true })
                            .eq('role', 'student')
                            .in('class_id', courseData.class_ids);

                        if (!studentsError && studentsCount) {
                            totalStudents = studentsCount;
                        }
                    }

                    return {
                        id: homework.id,
                        title: homework.title,
                        course_name: courseData.name,
                        deadline: homework.deadline,
                        published: homework.published,
                        submitted_count: submittedCount || 0,
                        total_students: totalStudents,
                        course_id: homework.course_id
                    };
                })
            );

            setHomeworks(homeworksWithStats);
        } catch (err: any) {
            console.error('获取作业列表失败:', err);
            setError(`获取作业列表失败: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const getHomeworkStatus = (homework: HomeworkWithStats) => {
        const now = new Date();
        const deadline = new Date(homework.deadline);

        if (!homework.published) {
            return { label: '未发布', color: 'gray' };
        }

        if (now > deadline) {
            return { label: '已截止', color: 'red' };
        }

        return { label: '活跃', color: 'green' };
    };

    const getSubmissionRate = (homework: HomeworkWithStats) => {
        if (homework.total_students === 0) return 0;
        return (homework.submitted_count / homework.total_students) * 100;
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
                    <Title order={1}>作业批改</Title>
                    <Text color="dimmed">管理并批改学生提交的作业</Text>
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
                                <Table.Th>作业名称</Table.Th>
                                <Table.Th>课程</Table.Th>
                                <Table.Th>状态</Table.Th>
                                <Table.Th>提交进度</Table.Th>
                                <Table.Th>截止时间</Table.Th>
                                <Table.Th>操作</Table.Th>
                            </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                            {homeworks.length === 0 ? (
                                <Table.Tr>
                                    <Table.Td colSpan={6} style={{ textAlign: 'center', padding: '2rem' }}>
                                        <Text color="dimmed">
                                            {loading ? '加载中...' : '暂无需要批改的作业'}
                                        </Text>
                                    </Table.Td>
                                </Table.Tr>
                            ) : (
                                homeworks.map((homework) => {
                                    const status = getHomeworkStatus(homework);
                                    const submissionRate = getSubmissionRate(homework);

                                    return (
                                        <Table.Tr key={homework.id}>
                                            <Table.Td>
                                                <Text fw={500}>{homework.title}</Text>
                                            </Table.Td>
                                            <Table.Td>
                                                <Text>{homework.course_name}</Text>
                                            </Table.Td>
                                            <Table.Td>
                                                <Badge color={status.color}>
                                                    {status.label}
                                                </Badge>
                                            </Table.Td>
                                            <Table.Td>
                                                <Stack gap="xs">
                                                    <Group gap="xs">
                                                        <IconUsers size={14} />
                                                        <Text size="sm">
                                                            {homework.submitted_count} / {homework.total_students}
                                                        </Text>
                                                    </Group>
                                                    <Progress
                                                        value={submissionRate}
                                                        size="sm"
                                                        color={submissionRate >= 80 ? 'green' : submissionRate >= 50 ? 'yellow' : 'red'}
                                                    />
                                                </Stack>
                                            </Table.Td>
                                            <Table.Td>
                                                <Group gap="xs">
                                                    <IconCalendar size={14} />
                                                    <Text size="sm">
                                                        {new Date(homework.deadline).toLocaleDateString('zh-CN')}
                                                    </Text>
                                                </Group>
                                            </Table.Td>
                                            <Table.Td>
                                                <Button
                                                    leftSection={<IconEye size={16} />}
                                                    variant="light"
                                                    onClick={() => navigate(`/grading/${homework.id}`)}
                                                >
                                                    查看详情
                                                </Button>
                                            </Table.Td>
                                        </Table.Tr>
                                    );
                                })
                            )}
                        </Table.Tbody>
                    </Table>
                </Paper>
            </Stack>
        </Container>
    );
};

export default GradingPage;