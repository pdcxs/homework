// pages/StudentReview.page.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Paper,
    Title,
    Container,
    Text,
    Flex,
    Stack,
    LoadingOverlay,
    Button,
    Group,
    Table,
    Badge,
    Grid,
    Textarea,
    Divider,
    Card
} from '@mantine/core';
import { IconArrowLeft, IconCheck, IconX, IconFileCode } from '@tabler/icons-react';
import { useAuth } from '@/App';
import { CodeEditorTabs } from '@/components/CodeEditorTabs';
import CodeEditor from '@/components/CodeEditor';

interface Review {
    id: number;
    homework_title: string;
    graded_at: string;
    grade: string;
    total_comment: string;
    comments: Comment[];
    files: FileContent[];
}

interface Comment {
    content: string;
    file: string;
    line: number;
}

interface FileContent {
    file_name: string;
    file_content: string;
    editable: boolean;
}

const StudentReviewPage: React.FC = () => {
    const navigate = useNavigate();
    const { supabaseClient, session } = useAuth();
    const [reviews, setReviews] = useState<Review[]>([]);
    const [selectedReview, setSelectedReview] = useState<Review | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [fileContents, setFileContents] = useState<Record<string, string>>({});
    const [activeFile, setActiveFile] = useState<string | null>(null);

    useEffect(() => {
        fetchReviews();
    }, []);

    const fetchReviews = async () => {
        try {
            setLoading(true);
            setError(null);

            if (!session) {
                throw new Error('用户未登录');
            }

            // 获取学生的批改记录
            const { data: checks, error: checksError } = await supabaseClient
                .from('checks')
                .select(`
                    id,
                    grade,
                    total_comment,
                    comments_contents,
                    comments_files,
                    comments_lines,
                    created_at,
                    answers (
                        id,
                        submitted_at,
                        storage_path,
                        homeworks (
                            id,
                            title
                        )
                    )
                `)
                .eq('answers.student_id', session.user.id)
                .order('created_at', { ascending: false });

            if (checksError) throw checksError;

            console.log('获取到的批改记录:', checks);

            const reviewData: Review[] = await Promise.all(
                (checks || []).map(async (check: any) => {
                    // 获取文件内容
                    const files = await fetchFileContents(check.answers.storage_path);

                    return {
                        id: check.id,
                        homework_title: check.answers.homeworks.title,
                        graded_at: check.created_at,
                        grade: check.grade,
                        total_comment: check.total_comment || '',
                        comments: (check.comments_contents || []).map((content: string, index: number) => ({
                            content,
                            file: check.comments_files?.[index] || '',
                            line: check.comments_lines?.[index] || 0
                        })),
                        files
                    };
                })
            );

            setReviews(reviewData);
        } catch (err: any) {
            console.error('获取批改记录失败:', err);
            setError(`获取批改记录失败: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const fetchFileContents = async (storagePath: string): Promise<FileContent[]> => {
        try {
            const { data: files, error: filesError } = await supabaseClient
                .storage
                .from('homework')
                .list(storagePath + "/");

            if (filesError) {
                console.error('获取文件列表失败:', filesError);
                return [];
            }

            const fileContents: FileContent[] = [];

            for (const file of files || []) {
                try {
                    const filePath = `${storagePath}/${file.name}`;
                    const { data: fileData, error: downloadError } = await supabaseClient
                        .storage
                        .from('homework')
                        .download(filePath);

                    if (!downloadError && fileData) {
                        const text = await fileData.text();
                        fileContents.push({
                            file_name: file.name,
                            file_content: text,
                            editable: false // 学生查看模式，不可编辑
                        });
                    }
                } catch (fileErr) {
                    console.error(`读取文件 ${file.name} 失败:`, fileErr);
                }
            }

            return fileContents;
        } catch (err) {
            console.error('获取文件内容失败:', err);
            return [];
        }
    };

    const handleSelectReview = (review: Review) => {
        setSelectedReview(review);

        // 初始化文件内容状态
        const contents: Record<string, string> = {};
        review.files.forEach(file => {
            contents[file.file_name] = file.file_content;
        });
        setFileContents(contents);

        if (review.files.length > 0) {
            setActiveFile(review.files[0].file_name);
        }
    };

    const getFileComments = (fileName: string) => {
        if (!selectedReview) return [];
        return selectedReview.comments.filter(comment => comment.file === fileName);
    };

    const renderCodeWithComments = (fileName: string, content: string) => {
        const fileComments = getFileComments(fileName);

        return (
            <div style={{ position: 'relative' }}>
                <CodeEditor
                    value={content}
                    onChange={() => { }} // 只读模式
                    language="cpp" // 可以根据文件扩展名动态设置
                    readOnly={true}
                    height="500px"
                />

                {/* 评论侧边栏 */}
                <div style={{
                    position: 'absolute',
                    right: 0,
                    top: 0,
                    width: '300px',
                    height: '100%',
                    backgroundColor: 'var(--mantine-color-gray-0)',
                    borderLeft: '1px solid var(--mantine-color-gray-3)',
                    overflowY: 'auto',
                    padding: '10px'
                }}>
                    <Text size="sm" fw={500} mb="md">评论</Text>

                    {fileComments.length === 0 ? (
                        <Text size="sm" c="dimmed">暂无评论</Text>
                    ) : (
                        <Stack gap="xs">
                            {fileComments.map((comment, index) => (
                                <Card key={index} p="xs" withBorder>
                                    <Text size="xs" c="dimmed">第 {comment.line} 行</Text>
                                    <Text size="sm">{comment.content}</Text>
                                </Card>
                            ))}
                        </Stack>
                    )}
                </div>
            </div>
        );
    };

    if (loading) {
        return (
            <Container size="lg" py="xl">
                <Paper p="xl" withBorder style={{ position: 'relative', height: '200px' }}>
                    <LoadingOverlay visible={loading} />
                </Paper>
            </Container>
        );
    }

    if (error) {
        return (
            <Container size="lg" py="xl">
                <Paper p="xl" withBorder>
                    <Stack gap="md" align="center">
                        <Text color="red" style={{ textAlign: 'center', fontWeight: 'bold' }} size="xl">
                            加载失败
                        </Text>
                        <Text style={{ textAlign: 'center' }} color="dimmed">
                            {error}
                        </Text>
                        <Group>
                            <Button
                                variant="outline"
                                onClick={() => navigate(-1)}
                            >
                                返回
                            </Button>
                            <Button
                                onClick={fetchReviews}
                            >
                                重试
                            </Button>
                        </Group>
                    </Stack>
                </Paper>
            </Container>
        );
    }

    return (
        <Container size="xl" py="xl">
            <Stack gap="xl">
                {/* 头部信息 */}
                <Flex justify="space-between" align="center">
                    <Group>
                        <Button
                            variant="subtle"
                            leftSection={<IconArrowLeft size={16} />}
                            onClick={() => navigate('/tasks')}
                        >
                            返回
                        </Button>
                        <div>
                            <Title order={1}>作业批改</Title>
                            <Text c="dimmed">查看教师批改反馈</Text>
                        </div>
                    </Group>
                    <Text color="dimmed">
                        共 {reviews.length} 份批改
                    </Text>
                </Flex>

                {error && (
                    <Paper p="md" withBorder bg="red.0">
                        <Text color="red">{error}</Text>
                    </Paper>
                )}

                <Grid>
                    {/* 左侧：批改列表 */}
                    <Grid.Col span={{ base: 12, lg: selectedReview ? 4 : 12 }}>
                        <Paper withBorder pos="relative">
                            <LoadingOverlay visible={loading} />
                            <Table>
                                <Table.Thead>
                                    <Table.Tr>
                                        <Table.Th>作业名称</Table.Th>
                                        <Table.Th>批改时间</Table.Th>
                                        <Table.Th>评分</Table.Th>
                                        <Table.Th>操作</Table.Th>
                                    </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                    {reviews.length === 0 ? (
                                        <Table.Tr>
                                            <Table.Td colSpan={4} style={{ textAlign: 'center', padding: '2rem' }}>
                                                <Text c="dimmed">
                                                    {loading ? '加载中...' : '暂无批改记录'}
                                                </Text>
                                            </Table.Td>
                                        </Table.Tr>
                                    ) : (
                                        reviews.map((review) => (
                                            <Table.Tr
                                                key={review.id}
                                                style={{
                                                    cursor: 'pointer',
                                                    backgroundColor: selectedReview?.id === review.id ? 'var(--mantine-color-blue-light)' : 'transparent'
                                                }}
                                                onClick={() => handleSelectReview(review)}
                                            >
                                                <Table.Td>
                                                    <Text fw={500}>{review.homework_title}</Text>
                                                </Table.Td>
                                                <Table.Td>
                                                    <Text size="sm">
                                                        {new Date(review.graded_at).toLocaleString('zh-CN')}
                                                    </Text>
                                                </Table.Td>
                                                <Table.Td>
                                                    <Badge
                                                        color="blue"
                                                        variant="light"
                                                    >
                                                        {review.grade}
                                                    </Badge>
                                                </Table.Td>
                                                <Table.Td>
                                                    <Button
                                                        variant="light"
                                                        size="xs"
                                                        onClick={() => handleSelectReview(review)}
                                                    >
                                                        查看详情
                                                    </Button>
                                                </Table.Td>
                                            </Table.Tr>
                                        ))
                                    )}
                                </Table.Tbody>
                            </Table>
                        </Paper>
                    </Grid.Col>

                    {/* 右侧：批改详情 */}
                    {selectedReview && (
                        <Grid.Col span={{ base: 12, lg: 8 }}>
                            <Stack gap="md">
                                {/* 批改概览 */}
                                <Paper p="md" withBorder>
                                    <Flex justify="space-between" align="center" mb="md">
                                        <Title order={3}>{selectedReview.homework_title}</Title>
                                        <Badge size="lg" color="blue">
                                            评分: {selectedReview.grade}
                                        </Badge>
                                    </Flex>

                                    <Text fw={500} mb="xs">总体评语:</Text>
                                    <Textarea
                                        value={selectedReview.total_comment}
                                        readOnly
                                        autosize
                                        minRows={3}
                                        styles={{
                                            input: {
                                                backgroundColor: 'var(--mantine-color-gray-0)',
                                                border: '1px solid var(--mantine-color-gray-3)'
                                            }
                                        }}
                                    />

                                    <Group mt="md" gap="xs">
                                        <IconFileCode size={16} />
                                        <Text size="sm" c="dimmed">
                                            共 {selectedReview.files.length} 个文件，{selectedReview.comments.length} 条评论
                                        </Text>
                                    </Group>
                                </Paper>

                                {/* 代码和评论 */}
                                {selectedReview.files.length > 0 ? (
                                    <Paper p="md" withBorder>
                                        <Title order={4} mb="md">代码批改详情</Title>

                                        <CodeEditorTabs
                                            files={selectedReview.files.map(file => ({
                                                ...file,
                                                id: file.file_name,
                                                isCustom: false
                                            }))}
                                            fileContents={fileContents}
                                            activeFile={activeFile}
                                            language="cpp" // 可以根据实际情况调整
                                            onFileChange={() => { }} // 只读模式
                                            onActiveFileChange={setActiveFile}
                                            onAddFile={() => { }} // 不需要添加文件
                                            onDeleteFile={() => { }} // 不需要删除文件
                                            onFileNameEdit={() => { }} // 不需要重命名文件
                                        />

                                        {/* 当前文件的评论 */}
                                        {activeFile && (
                                            <Paper p="md" withBorder mt="md">
                                                <Text fw={500} mb="sm">
                                                    文件 {activeFile} 的评论
                                                </Text>
                                                <Stack gap="xs">
                                                    {getFileComments(activeFile).length === 0 ? (
                                                        <Text size="sm" c="dimmed">该文件暂无评论</Text>
                                                    ) : (
                                                        getFileComments(activeFile).map((comment, index) => (
                                                            <Card key={index} p="sm" withBorder>
                                                                <Group justify="apart" mb="xs">
                                                                    <Badge size="sm" variant="light">
                                                                        第 {comment.line} 行
                                                                    </Badge>
                                                                </Group>
                                                                <Text size="sm">{comment.content}</Text>
                                                            </Card>
                                                        ))
                                                    )}
                                                </Stack>
                                            </Paper>
                                        )}
                                    </Paper>
                                ) : (
                                    <Paper p="xl" withBorder>
                                        <Text c="dimmed" ta="center">
                                            暂无代码文件
                                        </Text>
                                    </Paper>
                                )}
                            </Stack>
                        </Grid.Col>
                    )}
                </Grid>
            </Stack>
        </Container>
    );
};

export default StudentReviewPage;