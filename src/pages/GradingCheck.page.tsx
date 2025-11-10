// pages/GradingCheck.page.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Paper,
    Title,
    Container,
    Text,
    Flex,
    Stack,
    LoadingOverlay,
    Button,
    Textarea,
    TextInput,
    Group,
    Grid,
    Code,
    Badge,
    ActionIcon,
    Modal
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconArrowLeft, IconCheck, IconTrash, IconPlayerPlay, IconPlus } from '@tabler/icons-react';
import { useAuth } from '@/App';
import CodeEditor from '@/components/CodeEditor';
import { HomeworkDescription } from '@/components/HomeworkDescription'; // 新增导入
import { runCode, runAllTests, RunResult } from '@/lib/wandbox';

interface FileContent {
    [key: string]: string;
}

interface Comment {
    content: string;
    file: string;
    line: number;
}

const GradingCheckPage: React.FC = () => {
    const { answerId } = useParams();
    const navigate = useNavigate();
    const { supabaseClient, userRole } = useAuth();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fileContents, setFileContents] = useState<FileContent>({});
    const [activeFile, setActiveFile] = useState<string | null>(null);
    const [homework, setHomework] = useState<any>(null);
    const [student, setStudent] = useState<any>(null);
    const [runResult, setRunResult] = useState<RunResult | null>(null);
    const [running, setRunning] = useState(false);
    const [testing, setTesting] = useState(false);

    // 批改相关状态
    const [grade, setGrade] = useState('');
    const [totalComment, setTotalComment] = useState('');
    const [comments, setComments] = useState<Comment[]>([]);
    const [commentModalOpened, { open: openCommentModal, close: closeCommentModal }] = useDisclosure(false);
    const [currentComment, setCurrentComment] = useState('');
    const [currentCommentLine, setCurrentCommentLine] = useState(0);
    const [manualLineInput, setManualLineInput] = useState(''); // 新增：手动输入行号

    useEffect(() => {
        if (userRole === 'teacher' && answerId) {
            fetchSubmissionData();
        }
    }, [userRole, answerId]);

    const fetchSubmissionData = async () => {
        try {
            setLoading(true);
            setError(null);

            console.log('开始获取提交数据，answerId:', answerId);

            if (!answerId || isNaN(parseInt(answerId))) {
                throw new Error('无效的提交ID');
            }

            const answerIdNum = parseInt(answerId);

            const { data: answer, error: answerError } = await supabaseClient
                .from('answers')
                .select(`
                    *,
                    homeworks (
                        *,
                        courses (
                            name
                        )
                    )
                `)
                .eq('id', answerIdNum)
                .single();

            if (answerError) {
                console.error('获取提交信息失败:', answerError);
                throw new Error(`获取提交信息失败: ${answerError.message}`);
            }

            if (!answer) {
                throw new Error('未找到对应的提交记录');
            }

            console.log('获取到的提交数据:', answer);

            if (!answer.homeworks) {
                throw new Error('未找到对应的作业信息');
            }

            const { data: student, error: studentError } = await supabaseClient
                .from('profiles')
                .select('name, student_id')
                .eq('id', answer.student_id)
                .single();

            if (studentError) {
                console.error('获取学生信息失败:', studentError);
                throw new Error(`获取学生信息失败: ${studentError.message}`);
            }

            if (!student) {
                throw new Error('未找到对应的学生信息');
            }

            setHomework(answer.homeworks);
            setHomework((old: any) => ({ ...(old || {}), language: answer.language }));
            setRunResult({ output: answer.result, success: true });
            setStudent(student);

            console.log('获取文件列表，storage_path:', answer.storage_path);
            const { data: files, error: filesError } = await supabaseClient
                .storage
                .from('homework')
                .list(answer.storage_path + "/");

            if (filesError) {
                console.error('获取文件列表失败:', filesError);
            } else {
                console.log('获取到的文件列表:', files);
            }

            const contents: FileContent = {};
            if (files && files.length > 0) {
                for (const file of files) {
                    try {
                        const filePath = `${answer.storage_path}/${file.name}`;
                        console.log('下载文件:', filePath);

                        const { data: fileData, error: fileError } = await supabaseClient
                            .storage
                            .from('homework')
                            .download(filePath);

                        if (!fileError && fileData) {
                            const text = await fileData.text();
                            contents[file.name] = text;
                            console.log(`文件 ${file.name} 内容长度:`, text.length);
                        } else {
                            console.error(`下载文件 ${file.name} 失败:`, fileError);
                        }
                    } catch (fileErr) {
                        console.error(`读取文件 ${file.name} 失败:`, fileErr);
                    }
                }
            }

            setFileContents(contents);
            if (Object.keys(contents).length > 0) {
                setActiveFile(Object.keys(contents)[0]);
            }

            console.log('获取批改记录，answer_id:', answerIdNum);

            try {
                const { data: checks, error: checksError } = await supabaseClient
                    .rpc('get_check_by_answer_id', { p_answer_id: answerIdNum });

                if (checksError) {
                    console.log('RPC获取批改记录失败:', checksError);
                } else if (checks && checks.length > 0) {
                    console.log('获取到的批改记录:', checks[0]);
                    const checkData = checks[0];
                    setGrade(checkData.grade);
                    setTotalComment(checkData.total_comment || '');

                    if (checkData.comments_contents && checkData.comments_files && checkData.comments_lines) {
                        const existingComments: Comment[] = checkData.comments_contents.map((content: string, index: number) => ({
                            content,
                            file: checkData.comments_files[index],
                            line: checkData.comments_lines[index]
                        }));
                        setComments(existingComments);
                    }
                } else {
                    console.log('没有找到批改记录');
                }
            } catch (rpcError) {
                console.error('RPC调用失败:', rpcError);
            }

        } catch (err: any) {
            console.error('获取提交数据失败:', err);
            setError(`获取提交数据失败: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    // 新增：手动添加评论函数
    const handleManualAddComment = () => {
        if (!activeFile) {
            alert('请先选择一个文件');
            return;
        }

        const lineNumber = parseInt(manualLineInput);
        if (isNaN(lineNumber) || lineNumber < 1) {
            alert('请输入有效的行号');
            return;
        }

        setCurrentCommentLine(lineNumber);
        setCurrentComment('');
        openCommentModal();
    };

    const handleSaveComment = () => {
        if (currentComment.trim() && activeFile) {
            const newComment: Comment = {
                content: currentComment.trim(),
                file: activeFile,
                line: currentCommentLine
            };
            setComments(prev => [...prev, newComment]);
            setCurrentComment('');
            setManualLineInput(''); // 清空行号输入
            closeCommentModal();
        }
    };

    const handleRemoveComment = (index: number) => {
        setComments(prev => prev.filter((_, i) => i !== index));
    };

    const handleRunCode = async () => {
        if (!homework?.language) {
            alert('无法确定编程语言');
            return;
        }

        setRunning(true);
        setRunResult(null);

        try {
            const result = await runCode(
                fileContents,
                '',
                homework.language,
                homework.compile_options || '',
            );

            setRunResult(result);
        } catch (error) {
            console.error('运行代码失败:', error);
            setRunResult({
                success: false,
                output: '',
                error: '运行代码时发生错误',
            });
        } finally {
            setRunning(false);
        }
    };

    const handleTestCode = async () => {
        if (!homework?.language) {
            alert('无法确定编程语言');
            return;
        }

        if (!homework.inputs || !homework.outputs) {
            alert('该作业没有测试用例');
            return;
        }

        setTesting(true);

        try {
            const result = await runAllTests(
                fileContents,
                homework.inputs,
                homework.outputs,
                homework.language,
                homework.compile_options || ''
            );

            setRunResult(result);
        } catch (error) {
            console.error('测试代码失败:', error);
            setRunResult({
                success: false,
                output: '',
                error: '测试代码时发生错误',
            });
        } finally {
            setTesting(false);
        }
    };

    const handleSubmitCheck = async () => {
        if (!grade.trim()) {
            alert('请填写评分');
            return;
        }

        try {
            setSaving(true);

            const comments_contents = comments.map(c => c.content);
            const comments_files = comments.map(c => c.file);
            const comments_lines = comments.map(c => c.line);

            // 首先检查是否已存在批改记录
            const { data: existingCheck, error: checkError } = await supabaseClient
                .from('checks')
                .select('id')
                .eq('answer_id', parseInt(answerId!))
                .maybeSingle();

            if (checkError) {
                console.error('查询现有批改记录失败:', checkError);
                throw checkError;
            }

            let operationError;

            if (existingCheck) {
                const { error: updateError } = await supabaseClient
                    .from('checks')
                    .update({
                        grade,
                        total_comment: totalComment,
                        comments_contents,
                        comments_files,
                        comments_lines,
                        created_at: new Date().toISOString()
                    })
                    .eq('id', existingCheck.id);

                operationError = updateError;
            } else {
                // 插入新记录
                const { error: insertError } = await supabaseClient
                    .from('checks')
                    .insert({
                        answer_id: parseInt(answerId!),
                        grade,
                        total_comment: totalComment,
                        comments_contents,
                        comments_files,
                        comments_lines,
                        created_at: new Date().toISOString(),
                    });

                operationError = insertError;
            }

            if (operationError) throw operationError;

            // 查找下一个未批改的作业
            const { data: nextAnswers, error: nextError } = await supabaseClient
                .from('answers')
                .select(`
                    id,
                    checks (id)
                `)
                .eq('homework_id', homework.id)
                .is('checks', null)
                .limit(1);

            if (!nextError && nextAnswers && nextAnswers.length > 0) {
                navigate(`/grading/check/${nextAnswers[0].id}`);
            } else {
                navigate(`/grading/${homework.id}`);
            }

        } catch (err: any) {
            console.error('提交批改失败:', err);
            setError(`提交批改失败: ${err.message}`);
        } finally {
            setSaving(false);
        }
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
                                onClick={fetchSubmissionData}
                            >
                                重试
                            </Button>
                        </Group>
                    </Stack>
                </Paper>
            </Container>
        );
    }

    if (!homework || !student) {
        return (
            <Container size="lg" py="xl">
                <Paper p="xl" withBorder>
                    <Stack gap="md" align="center">
                        <Text style={{ textAlign: 'center', fontWeight: 'bold' }} size="xl">
                            数据不完整
                        </Text>
                        <Text style={{ textAlign: 'center' }} color="dimmed">
                            无法加载作业或学生信息
                        </Text>
                        <Group>
                            <Button
                                variant="outline"
                                onClick={() => navigate(-1)}
                            >
                                返回
                            </Button>
                            <Button
                                onClick={fetchSubmissionData}
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
                <Flex justify="space-between" align="center">
                    <Group>
                        <Button
                            variant="subtle"
                            leftSection={<IconArrowLeft size={16} />}
                            onClick={() => navigate(`/grading/${homework.id}`)}
                        >
                            返回
                        </Button>
                        <div>
                            <Title order={1}>批改作业</Title>
                            <Text c="dimmed">
                                {homework?.title || '未知作业'} - {student?.name || '未知学生'} ({student?.student_id || '未知学号'})
                            </Text>
                        </div>
                    </Group>
                    <Button
                        leftSection={<IconCheck size={16} />}
                        loading={saving}
                        onClick={handleSubmitCheck}
                    >
                        提交批改
                    </Button>
                </Flex>

                {error && (
                    <Paper p="md" withBorder bg="red.0">
                        <Text color="red">{error}</Text>
                    </Paper>
                )}

                <Grid>
                    <Grid.Col span={{ base: 12, lg: 8 }}>
                        <Stack gap="md">
                            <Paper p="md" withBorder>
                                <Flex justify="space-between" align="center" mb="md">
                                    <Title order={3}>学生代码</Title>
                                    <Group>
                                        <Button
                                            leftSection={<IconPlayerPlay size={16} />}
                                            variant="light"
                                            loading={running}
                                            onClick={handleRunCode}
                                        >
                                            运行代码
                                        </Button>
                                        {homework.inputs && homework.outputs && (
                                            <Button
                                                leftSection={<IconPlayerPlay size={16} />}
                                                variant="light"
                                                loading={testing}
                                                onClick={handleTestCode}
                                            >
                                                测试代码
                                            </Button>
                                        )}
                                    </Group>
                                </Flex>

                                <Flex wrap="wrap" gap="xs" mb="md">
                                    {Object.keys(fileContents).map(filename => (
                                        <Button
                                            key={filename}
                                            variant={activeFile === filename ? 'filled' : 'light'}
                                            style={{ cursor: 'pointer' }}
                                            onClick={() => setActiveFile(filename)}
                                        >
                                            {filename}
                                        </Button>
                                    ))}
                                </Flex>

                                {activeFile && fileContents[activeFile] && (
                                    <div style={{ position: 'relative' }}>
                                        <CodeEditor
                                            value={fileContents[activeFile]}
                                            onChange={() => { }}
                                            language={homework.language}
                                            readOnly={true}
                                            height="500px"
                                        // 移除了 onLineClick 属性
                                        />
                                    </div>
                                )}
                            </Paper>

                            {runResult && (
                                <Paper p="md" withBorder>
                                    <Title order={3} mb="md">运行结果</Title>
                                    <Code block style={{ whiteSpace: 'pre-wrap', width: '100%' }}>
                                        {runResult.success ? runResult.output : runResult.error}
                                    </Code>
                                    {runResult.testResults && (
                                        <div style={{ marginTop: '1rem' }}>
                                            <Text fw={500}>测试结果:</Text>
                                            {runResult.testResults.map((result, index) => (
                                                <Badge
                                                    key={index}
                                                    color={result.passed ? 'green' : 'red'}
                                                    style={{ marginRight: '0.5rem', marginTop: '0.5rem' }}
                                                >
                                                    测试 {index + 1}: {result.passed ? '通过' : '失败'}
                                                </Badge>
                                            ))}
                                        </div>
                                    )}
                                </Paper>
                            )}
                        </Stack>
                    </Grid.Col>

                    <Grid.Col span={{ base: 12, lg: 4 }}>
                        <Stack gap="md">
                            {/* 修改：使用 HomeworkDescription 组件 */}
                            <Paper p="md" withBorder>
                                <HomeworkDescription description={homework.description} />
                                {homework.compile_options && (
                                    <div style={{ marginTop: '1rem' }}>
                                        <Text fw={500}>编译选项:</Text>
                                        <Code>{homework.compile_options}</Code>
                                    </div>
                                )}
                                {/* 新增：显示 result */}
                                {homework.result && (
                                    <div style={{ marginTop: '1rem' }}>
                                        <Text fw={500}>运行结果:</Text>
                                        <Code block style={{ whiteSpace: 'pre-wrap' }}>
                                            {homework.result}
                                        </Code>
                                    </div>
                                )}
                            </Paper>

                            <Paper p="md" withBorder>
                                <Title order={3} mb="md">评分</Title>
                                <TextInput
                                    label="评分/等级"
                                    placeholder="例如: A, 95分, 优秀等"
                                    value={grade}
                                    onChange={(e) => setGrade(e.target.value)}
                                    required
                                />
                                <Textarea
                                    label="总体评语"
                                    placeholder="输入对作业的总体评价"
                                    value={totalComment}
                                    onChange={(e) => setTotalComment(e.target.value)}
                                    autosize
                                    minRows={3}
                                    style={{ marginTop: '1rem' }}
                                />
                            </Paper>

                            <Paper p="md" withBorder>
                                <Flex justify="space-between" align="center" mb="md">
                                    <Title order={3}>代码评论</Title>
                                    <Text color="dimmed" size="sm">
                                        {comments.length} 条评论
                                    </Text>
                                </Flex>

                                {/* 新增：手动添加评论的输入区域 */}
                                <Group mb="md" grow>
                                    <TextInput
                                        placeholder="输入行号"
                                        value={manualLineInput}
                                        onChange={(e) => setManualLineInput(e.target.value)}
                                        type="number"
                                        min={1}
                                    />
                                    <Button
                                        leftSection={<IconPlus size={14} />}
                                        onClick={handleManualAddComment}
                                        disabled={!activeFile}
                                    >
                                        添加评论
                                    </Button>
                                </Group>

                                <Stack gap="sm">
                                    {comments.map((comment, index) => (
                                        <Paper key={index} p="sm" withBorder bg="gray.0">
                                            <Flex justify="space-between" align="start">
                                                <div style={{ flex: 1 }}>
                                                    <Text size="sm" fw={500}>
                                                        {comment.file}:{comment.line}
                                                    </Text>
                                                    <Text size="sm" style={{ marginTop: '0.25rem' }}>
                                                        {comment.content}
                                                    </Text>
                                                </div>
                                                <ActionIcon
                                                    color="red"
                                                    size="sm"
                                                    onClick={() => handleRemoveComment(index)}
                                                >
                                                    <IconTrash size={14} />
                                                </ActionIcon>
                                            </Flex>
                                        </Paper>
                                    ))}

                                    {comments.length === 0 && (
                                        <Text color="dimmed" size="sm" style={{ textAlign: 'center' }} py="md">
                                            暂无评论，使用上方输入框添加评论
                                        </Text>
                                    )}
                                </Stack>
                            </Paper>
                        </Stack>
                    </Grid.Col>
                </Grid>
            </Stack>

            <Modal
                opened={commentModalOpened}
                onClose={closeCommentModal}
                title={`添加评论 - ${activeFile}:${currentCommentLine}`}
            >
                <Stack gap="md">
                    <Textarea
                        label="评论内容"
                        placeholder="输入对代码的评论"
                        value={currentComment}
                        onChange={(e) => setCurrentComment(e.target.value)}
                        autosize
                        minRows={3}
                    />
                    <Group justify="flex-end">
                        <Button variant="outline" onClick={closeCommentModal}>
                            取消
                        </Button>
                        <Button onClick={handleSaveComment}>
                            保存评论
                        </Button>
                    </Group>
                </Stack>
            </Modal>
        </Container>
    );
};

export default GradingCheckPage;