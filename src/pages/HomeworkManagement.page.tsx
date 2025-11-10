// pages/HomeworkManagement.page.tsx
import React, { useState, useEffect } from 'react';
import {
    Table,
    Button,
    Paper,
    Title,
    Container,
    ActionIcon,
    Modal,
    Text,
    Badge,
    LoadingOverlay,
    Notification,
    Flex,
    Group,
} from '@mantine/core';
import { IconEdit, IconTrash, IconPlus, IconEye, IconSchool } from '@tabler/icons-react';
import { useAuth } from '@/App';
import { useNavigate } from 'react-router-dom';

interface Course {
    id: number;
    name: string;
    language: string;
}

interface Homework {
    id: number;
    course_id: number;
    title: string;
    description: string;
    deadline: string;
    created_at: string;
    published: boolean;
    compile_options?: string;
    inputs?: string[];
    outputs?: string[];
    course_name: string;
    language: string;
}

const HomeworkManagement: React.FC = () => {
    const { supabaseClient: supabase, userRole } = useAuth();
    const navigate = useNavigate();

    const [homeworks, setHomeworks] = useState<Homework[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [deletingHomework, setDeletingHomework] = useState<Homework | null>(null);

    // 获取数据
    useEffect(() => {
        if (userRole === 'teacher') {
            fetchHomeworks();
        }
    }, [userRole]);

    const fetchHomeworks = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('homeworks')
                .select(`
          *,
          courses(name, language)
        `)
                .order('created_at', { ascending: false });

            if (error) throw error;

            const processedHomeworks = data?.map(hw => ({
                ...hw,
                course_name: hw.courses.name,
                language: hw.courses.language,
            })) || [];

            setHomeworks(processedHomeworks);
        } catch (err: any) {
            console.error('获取作业失败:', err);
            setError(`获取作业失败: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteHomework = async () => {
        if (!deletingHomework) return;

        try {
            setError(null);
            const { error } = await supabase
                .from('homeworks')
                .delete()
                .eq('id', deletingHomework.id);

            if (error) throw error;

            setSuccess('作业删除成功');
            setDeletingHomework(null);
            fetchHomeworks();
        } catch (err: any) {
            console.error('删除失败:', err);
            setError(`删除失败: ${err.message}`);
        }
    };

    const handlePublishToggle = async (homework: Homework) => {
        try {
            const { error } = await supabase
                .from('homeworks')
                .update({ published: !homework.published })
                .eq('id', homework.id);

            if (error) throw error;

            setSuccess(`作业已${!homework.published ? '发布' : '取消发布'}`);
            fetchHomeworks();
        } catch (err: any) {
            console.error('更新发布状态失败:', err);
            setError(`更新发布状态失败: ${err.message}`);
        }
    };

    const handleCreateHomework = () => {
        navigate('/homework-create');
    };

    const handleEditHomework = (homework: Homework) => {
        navigate(`/homework-edit/${homework.id}`);
    };

    const handlePreviewHomework = (homework: Homework) => {
        navigate(`/homework-preview/${homework.id}?preview=true`);
    };

    if (userRole !== 'teacher') {
        return (
            <Container size="lg" py="xl">
                <Paper p="xl" withBorder>
                    <Text style={{ textAlign: 'center', fontWeight: 'bold' }} size="xl">
                        无访问权限
                    </Text>
                    <Text style={{ textAlign: 'center' }} color="dimmed" mt="md">
                        只有教师可以访问作业管理页面
                    </Text>
                </Paper>
            </Container>
        );
    }

    return (
        <Container size="lg" py="xl">
            <Flex justify="space-between" align="center" mb="xl">
                <div>
                    <Title order={1}>作业管理</Title>
                    <Text color="dimmed" mt="xs">
                        管理您的作业和测试用例
                    </Text>
                </div>
                <Button
                    leftSection={<IconPlus size={16} />}
                    onClick={handleCreateHomework}
                >
                    新建作业
                </Button>
            </Flex>

            {error && (
                <Notification color="red" onClose={() => setError(null)} mb="md">
                    {error}
                </Notification>
            )}

            {success && (
                <Notification color="green" onClose={() => setSuccess(null)} mb="md">
                    {success}
                </Notification>
            )}

            <Paper withBorder pos="relative">
                <LoadingOverlay visible={loading} />
                <Table>
                    <Table.Thead>
                        <Table.Tr>
                            <Table.Th>作业标题</Table.Th>
                            <Table.Th>所属课程</Table.Th>
                            <Table.Th>截止时间</Table.Th>
                            <Table.Th>状态</Table.Th>
                            <Table.Th>创建时间</Table.Th>
                            <Table.Th>操作</Table.Th>
                        </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                        {homeworks.length === 0 ? (
                            <Table.Tr>
                                <Table.Td colSpan={6} style={{ textAlign: 'center', padding: '2rem' }}>
                                    <IconSchool size={48} color="#ccc" />
                                    <Text mt="sm" color="dimmed">
                                        暂无作业，请点击"新建作业"创建您的第一个作业
                                    </Text>
                                </Table.Td>
                            </Table.Tr>
                        ) : (
                            homeworks.map((homework) => (
                                <Table.Tr key={homework.id}>
                                    <Table.Td>
                                        <Text fw={500}>{homework.title}</Text>
                                    </Table.Td>
                                    <Table.Td>
                                        <Text size="sm">{homework.course_name}</Text>
                                    </Table.Td>
                                    <Table.Td>
                                        <Text size="sm">
                                            {new Date(homework.deadline).toLocaleDateString('zh-CN')}
                                        </Text>
                                    </Table.Td>
                                    <Table.Td>
                                        <Badge color={homework.published ? 'green' : 'gray'}>
                                            {homework.published ? '已发布' : '草稿'}
                                        </Badge>
                                    </Table.Td>
                                    <Table.Td>
                                        <Text size="sm">
                                            {new Date(homework.created_at).toLocaleDateString('zh-CN')}
                                        </Text>
                                    </Table.Td>
                                    <Table.Td>
                                        <Group gap="xs" wrap="nowrap">
                                            <ActionIcon
                                                onClick={() => handlePreviewHomework(homework)}
                                                title="预览"
                                                variant="subtle"
                                            >
                                                <IconEye size="1rem" stroke={1.5} />
                                            </ActionIcon>
                                            <ActionIcon
                                                onClick={() => handleEditHomework(homework)}
                                                title="编辑"
                                                variant="subtle"
                                            >
                                                <IconEdit size="1rem" stroke={1.5} />
                                            </ActionIcon>
                                            <ActionIcon
                                                color="red"
                                                onClick={() => setDeletingHomework(homework)}
                                                title="删除"
                                                variant="subtle"
                                            >
                                                <IconTrash size="1rem" stroke={1.5} />
                                            </ActionIcon>
                                        </Group>
                                    </Table.Td>
                                </Table.Tr>
                            ))
                        )}
                    </Table.Tbody>
                </Table>
            </Paper>

            {/* 删除确认模态框 */}
            <Modal
                opened={!!deletingHomework}
                onClose={() => setDeletingHomework(null)}
                title="确认删除"
            >
                <Text>
                    确定要删除作业 "{deletingHomework?.title}" 吗？此操作无法撤销。
                </Text>
                <Text size="sm" color="red" mt="md">
                    注意：删除作业将同时删除与该作业相关的所有学生提交记录和文件。
                </Text>

                <Flex justify="flex-end" mt="xl" gap="md">
                    <Button variant="outline" onClick={() => setDeletingHomework(null)}>
                        取消
                    </Button>
                    <Button color="red" onClick={handleDeleteHomework}>
                        确认删除
                    </Button>
                </Flex>
            </Modal>
        </Container>
    );
};

export default HomeworkManagement;