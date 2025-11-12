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
    Group,
    Alert
} from '@mantine/core';
import { IconArrowLeft, IconCheck, IconX, IconEye, IconAlertCircle, IconDownload } from '@tabler/icons-react';
import { useAuth } from '@/App';
import { fetchCheckRecord, fetchFileContents, Review, Submission } from '@/lib/database';
import {
    initializeTypst,
    loadTypstScript,
    generateTypstSource,
    generatePdf,
    openPdf
} from '@/lib/typst';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

const GradingDetailPage: React.FC = () => {
    const { homeworkId } = useParams();
    const navigate = useNavigate();
    const { supabaseClient, userRole } = useAuth();
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [homeworkTitle, setHomeworkTitle] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [previewLoading, setPreviewLoading] = useState<number | null>(null);
    const [typstLoaded, setTypstLoaded] = useState(false);
    const [typstError, setTypstError] = useState<string | null>(null);
    const [exporting, setExporting] = useState(false);

    useEffect(() => {
        const initTypst = async () => {
            if (window.$typst && window.$typst.__initialized) {
                setTypstLoaded(true);
                return;
            }

            const scriptLoaded = await loadTypstScript();
            if (!scriptLoaded) {
                setTypstError('加载 Typst 编译器失败，请检查网络连接');
                return;
            }

            const initialized = await initializeTypst({
                onSuccess: () => setTypstLoaded(true),
                onError: (errorMsg) => setTypstError(errorMsg)
            });

            if (initialized) {
                setTypstLoaded(true);
            }
        };

        initTypst();
    }, []);

    useEffect(() => {
        if (userRole === 'teacher' && homeworkId) {
            fetchSubmissions();
        }
    }, [userRole, homeworkId]);

    const fetchSubmissions = async () => {
        try {
            setLoading(true);

            const { data: homework, error: homeworkError } = await supabaseClient
                .from('homeworks')
                .select('title')
                .eq('id', homeworkId)
                .single();

            if (homeworkError) throw homeworkError;
            setHomeworkTitle(homework.title);

            const { data: answers, error: answersError } = await supabaseClient
                .rpc('get_teacher_submissions', { homework_id: parseInt(homeworkId!) });

            if (answersError) throw answersError;

            console.log('RPC 返回数据:', answers);

            const submissionData: Submission[] = answers.map((answer: any) => {
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

    const handlePreview = async (submission: Submission) => {
        if (!submission || !supabaseClient) {
            setError('未选择提交记录或客户端未初始化');
            return;
        }

        if (!typstLoaded) {
            setError('Typst 编译器正在加载中，请稍后重试');
            return;
        }

        if (previewLoading === submission.id) {
            return;
        }

        setPreviewLoading(submission.id);
        setError(null);

        try {
            console.log('开始获取学生作业文件内容和批改记录...');

            const files = await fetchFileContents(supabaseClient, submission.storage_path);

            if (files.length === 0) {
                throw new Error('未找到学生作业文件');
            }

            const checkRecord = await fetchCheckRecord(supabaseClient, submission.id);

            const review: Review = {
                id: checkRecord?.id || 0,
                homework_title: checkRecord?.answers.homeworks.title || homeworkTitle,
                description: checkRecord?.answers.homeworks.description || '',
                course_name: checkRecord?.answers.homeworks.courses.name || '',
                graded_at: checkRecord?.created_at || '',
                grade: checkRecord?.grade || submission.grade || '未评分',
                total_comment: checkRecord?.total_comment || '暂无评语',
                comments: (checkRecord?.comments_contents || []).map((content: string, index: number) => ({
                    content,
                    file: checkRecord?.comments_files?.[index] || '',
                    line: checkRecord?.comments_lines?.[index] || 0
                })),
                storage_path: submission.storage_path
            };

            console.log('开始生成 Typst 源代码...');
            const source = generateTypstSource(review, files);

            console.log('开始编译 PDF...');
            const pdfData = await generatePdf(source);

            const opened = openPdf(pdfData);
            if (!opened) {
                setError('请允许弹出窗口以查看 PDF');
            }
        } catch (err: any) {
            console.error('生成预览 PDF 失败:', err);
            setError('生成预览 PDF 失败: ' + (err as Error).message);
        } finally {
            setPreviewLoading(null);
        }
    };

    const renderCompilerStatus = () => {
        if (typstError) {
            return (
                <Alert icon={<IconAlertCircle size={16} />} title="编译器加载失败" color="red" mb="md">
                    {typstError}
                    <Button
                        size="xs"
                        variant="light"
                        onClick={() => window.location.reload()}
                        ml="sm"
                    >
                        重试
                    </Button>
                </Alert>
            );
        }

        if (!typstLoaded) {
            return (
                <Alert icon={<IconAlertCircle size={16} />} title="编译器加载中" color="blue" mb="md">
                    Typst 编译器正在加载，预览功能将在加载完成后可用...
                </Alert>
            );
        }

        return null;
    };

    const handleExportAllSequential = async () => {
        if (!submissions.length) {
            setError('没有可导出的学生作业');
            return;
        }

        setExporting(true);
        setError(null);

        try {
            const zip = new JSZip();
            const readOnlyFolder = zip.folder('只读文件');
            const processedReadOnlyFiles = new Set<string>();

            for (const submission of submissions) {
                try {
                    console.log(`正在处理学生 ${submission.student_name} 的作业...`);

                    const files = await fetchFileContents(supabaseClient, submission.storage_path);

                    if (files.length === 0) {
                        console.warn(`学生 ${submission.student_name} 没有找到文件`);
                        continue;
                    }

                    // 创建学生文件夹
                    const studentFolderName = `${submission.student_name} - ${submission.student_id_number}`;
                    const studentFolder = zip.folder(studentFolderName);
                    console.log("files: ", files);

                    files.forEach(file => {
                        if (!file.editable) {
                            if (readOnlyFolder && !processedReadOnlyFiles.has(file.file_name)) {
                                readOnlyFolder.file(file.file_name, file.file_content);
                                processedReadOnlyFiles.add(file.file_name);
                            }
                        } else {
                            if (studentFolder) {
                                studentFolder.file(file.file_name, file.file_content);
                            }
                        }
                    });

                    console.log(`学生 ${submission.student_name} 处理完成`);

                } catch (err) {
                    console.error(`处理学生 ${submission.student_name} 的作业时出错:`, err);
                }
            }

            const zipBlob = await zip.generateAsync({ type: 'blob' });
            saveAs(zipBlob, `${homeworkTitle}-学生作业.zip`);

            console.log('导出完成');

        } catch (err: any) {
            console.error('导出失败:', err);
            setError(`导出失败: ${err.message}`);
        } finally {
            setExporting(false);
        }
    };

    const renderSubmissions = () => {
        if (submissions.length === 0) {
            return (
                <Table.Tr>
                    <Table.Td colSpan={7} style={{ textAlign: 'center', padding: '2rem' }}>
                        <Text c="dimmed">
                            {loading ? '加载中...' : '暂无学生提交'}
                        </Text>
                    </Table.Td>
                </Table.Tr>
            );
        }

        return submissions.map((submission) => {
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
                        <Flex>
                            <Button
                                variant="light"
                                onClick={() => navigate(`/grading/check/${submission.id}`)}
                            >
                                {submission.has_check ? '重新批改' : '开始批改'}
                            </Button>
                            <Button
                                variant="subtle"
                                loading={previewLoading === submission.id}
                                disabled={(!typstLoaded || !!typstError) && submission.has_check}
                                onClick={() => handlePreview(submission)}
                            >
                                <IconEye />
                            </Button>
                        </Flex>
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
                    <Text style={{ textAlign: 'center' }} c="dimmed" mt="md">
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
                            <Text c="dimmed">学生提交记录</Text>
                        </div>
                    </Group>
                    <Group>
                        <Text c="dimmed">
                            共 {submissions.length} 份提交
                        </Text>
                        <Button
                            leftSection={<IconDownload size={16} />}
                            onClick={handleExportAllSequential}
                            loading={exporting}
                            disabled={submissions.length === 0 || exporting}
                            variant="filled"
                        >
                            导出所有作业
                        </Button>
                    </Group>
                </Flex>

                {renderCompilerStatus()}

                {error && (
                    <Paper p="md" withBorder bg="red.0">
                        <Text c="red">{error}</Text>
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