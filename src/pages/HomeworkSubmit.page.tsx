// pages/HomeworkSubmit.page.tsx
import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Stack, Grid, Group, Text, Paper, Button, Title, Modal } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useForm } from '@mantine/form';
import { useAuth } from '@/App';
import LoaderComponent from '@/components/LoaderComponent';
import { HomeworkHeader } from '@/components/HomeworkHeader';
import { CompileOptionsPanel } from '@/components/CompileOptionsPanel';
import { HomeworkDescription } from '@/components/HomeworkDescription';
import { CodeEditorTabs, CustomFile } from '@/components/CodeEditorTabs';
import { RunResultPanel } from '@/components/RunResultPanel';
import { SubmissionModals } from '@/components/SubmissionModals';

import {
    FILE_EXTENSIONS,
    runCode,
    runAllTests,
    RunResult
} from '@/lib/wandbox';
import {
    fetchHomeworkData,
    fetchUserProfile,
    checkPreviousSubmission,
    loadSubmittedFiles,
    submitHomework as submitHomeworkToDB,
    HomeworkDetails,
    UserProfile
} from '@/lib/database';

export default function HomeworkSubmitPage() {
    const { id: homeworkId } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { supabaseClient: supabase, userRole } = useAuth();

    // 检查是否为预览模式
    const isPreview = searchParams.get('preview') === 'true';
    const isTeacher = userRole === 'teacher';

    const [homework, setHomework] = useState<HomeworkDetails | null>(null);
    const [files, setFiles] = useState<CustomFile[]>([]);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [running, setRunning] = useState(false);
    const [hasTestCases, setHasTestCases] = useState(false);
    const [testing, setTesting] = useState(false);
    const [runResult, setRunResult] = useState<RunResult | null>(null);
    const [activeFile, setActiveFile] = useState<string | null>(null);
    const [fileContents, setFileContents] = useState<Record<string, string>>({});
    const [initialFileContents, setInitialFileContents] = useState<Record<string, string>>({});
    const [submittedFileContents, setSubmittedFileContents] = useState<Record<string, string>>({});
    const [hasPreviousSubmission, setHasPreviousSubmission] = useState(false);
    const [selectLanguageModalOpened, { open: selectLanguageModalOpen, close: selectLanguageModalClose }] = useDisclosure(false);

    const [noRunOpened, { open: openNoRun, close: closeNoRun }] = useDisclosure(false);
    const [testWarningOpened, { open: openTestWarning, close: closeTestWarning }] = useDisclosure(false);

    const form = useForm({
        initialValues: {
            language: '',
            compileOptions: '',
            stdin: '',
        },
    });

    useEffect(() => {
        if (homeworkId) {
            fetchData();
        }
    }, [homeworkId]);

    useEffect(() => {
        setHasTestCases(
            Boolean(
                homework?.inputs && homework.inputs.length > 0 &&
                homework?.outputs && homework.outputs.length === homework.inputs.length
            ))
    }, [homework])

    const fetchData = async () => {
        try {
            setLoading(true);

            // 如果是预览模式且是教师，不需要用户信息
            if (!isPreview || !isTeacher) {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) throw new Error('用户未登录');

                const profileData = await fetchUserProfile(supabase, user.id);
                if (!profileData) throw new Error('用户信息不存在');
                setProfile(profileData);
            }

            const homeworkData = await fetchHomeworkData(supabase, homeworkId!);
            if (!homeworkData) throw new Error('作业不存在');

            const { homework: homeworkDetails, files: filesData } = homeworkData;
            setHomework(homeworkDetails);

            // 转换文件类型
            const editorFiles: CustomFile[] = filesData.map(file => ({
                ...file,
                id: file.id.toString(),
                isCustom: false
            }));
            setFiles(editorFiles);

            const language = homeworkDetails.language === '*' ? '' : homeworkDetails.language;
            form.setFieldValue('language', language);

            if (homeworkDetails.compile_options) {
                form.setFieldValue('compileOptions', homeworkDetails.compile_options);
            }

            // 初始化文件内容
            const initialContents: Record<string, string> = {};
            filesData.forEach(file => {
                initialContents[file.file_name] = file.file_content;
            });
            setInitialFileContents(initialContents);
            setFileContents(initialContents);

            // 设置第一个文件为激活状态
            if (filesData.length > 0) {
                setActiveFile(filesData[0].file_name);
            }

            // 如果不是预览模式，检查是否有之前的提交
            if (!isPreview) {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const submission = await checkPreviousSubmission(supabase, homeworkId!, user.id);
                    if (submission.hasSubmission && submission.storagePath) {
                        const submittedContents = await loadSubmittedFiles(supabase, submission.storagePath);
                        setSubmittedFileContents(submittedContents);
                        if (Object.keys(submittedContents).length > 0) {
                            setFileContents(submittedContents);
                        }
                        setHasPreviousSubmission(true);
                    }
                }
            }

        } catch (error) {
            console.error('获取作业数据失败:', error);
        } finally {
            setLoading(false);
        }
    };

    // 文件操作函数 - 在预览模式下禁用
    const handleAddFile = () => {
        if (form.values.language === '') {
            selectLanguageModalOpen();
            return;
        }
        const extension = FILE_EXTENSIONS[form.values.language] || '.txt';
        const newFileName = `new_file${files.length + 1}${extension}`;
        const newFile: CustomFile = {
            id: `custom-${Date.now()}`,
            file_name: newFileName,
            file_content: '',
            editable: true,
            isCustom: true,
        };

        setFiles(prev => [...prev, newFile]);
        setFileContents(prev => ({
            ...prev,
            [newFileName]: ''
        }));
        setActiveFile(newFileName);
    };

    const handleDeleteFile = (fileName: string) => {
        const file = files.find(f => f.file_name === fileName);
        if (file && !file.editable) {
            alert('无法删除只读文件');
            return;
        }

        setFiles(prev => prev.filter(file => file.file_name !== fileName));
        setFileContents(prev => {
            const newContents = { ...prev };
            delete newContents[fileName];
            return newContents;
        });

        if (activeFile === fileName) {
            const remainingFiles = files.filter(f => f.file_name !== fileName);
            setActiveFile(remainingFiles.length > 0 ? remainingFiles[0].file_name : null);
        }
    };

    const handleFileNameEdit = (oldFileName: string, newFileName: string) => {
        setFiles(prev => prev.map(file =>
            file.file_name === oldFileName
                ? { ...file, file_name: newFileName }
                : file
        ));

        setFileContents(prev => {
            const newContents = { ...prev };
            if (newContents[oldFileName] !== undefined) {
                newContents[newFileName] = newContents[oldFileName];
                delete newContents[oldFileName];
            }
            return newContents;
        });

        if (activeFile === oldFileName) {
            setActiveFile(newFileName);
        }
    };

    const handleFileContentChange = (fileName: string, content: string) => {
        setFileContents(prev => ({
            ...prev,
            [fileName]: content
        }));
    };

    const handleResetToOriginal = () => {
        setFileContents({ ...initialFileContents });
        // 移除自定义文件
        setFiles(prev => prev.filter(file => !file.isCustom));
    };

    const handleResetToPreviousSubmission = () => {
        if (isPreview) return;
        if (Object.keys(submittedFileContents).length > 0) {
            setFileContents({ ...submittedFileContents });
        }
    };

    // 运行和提交函数
    const handleRunCode = async () => {
        if (!form.values.language) {
            alert('请选择编程语言');
            return;
        }

        setRunning(true);
        setRunResult(null);

        try {
            const result = await runCode(
                fileContents,
                form.values.stdin,
                form.values.language,
                form.values.compileOptions,
            );

            setRunResult(result);
            setHomework(old => old ? { ...old, result: result.output } : old);

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
        if (!form.values.language) {
            alert('请选择编程语言');
            return;
        }

        if (!hasTestCases) {
            alert('当前作业没有测试用例');
            return;
        }

        setTesting(true);
        setRunResult(null);

        try {
            const result = await runAllTests(
                fileContents,
                homework!.inputs!,
                homework!.outputs!,
                form.values.language,
                form.values.compileOptions
            );

            setRunResult(result);
            setHomework(old => old ? { ...old, result: result.output } : old);

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

    const handleSubmit = async () => {
        if (isPreview) {
            alert('预览模式下不能提交作业');
            return;
        }

        if (hasTestCases) {
            if (!runResult || runResult.testResults === undefined) {
                openTestWarning();
                return;
            }
        } else {
            if (!runResult) {
                openNoRun();
                return;
            }
        }

        await submitHomework();
    };

    const submitHomework = async () => {
        if (!homework || !profile) return;

        setSubmitting(true);
        closeNoRun();
        closeTestWarning();

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('用户未登录');

            const success = await submitHomeworkToDB(
                supabase,
                homework.id,
                user.id,
                fileContents,
                form.values.language,
                hasTestCases ? "通过 " + runResult?.testResults?.filter((r) => r.passed).length.toString() + " 个测试" +
                    "未通过 " + runResult?.testResults?.filter((r) => !r.passed).length.toString() + " 个测试"
                    : runResult?.output
            );

            if (success) {
                navigate('/tasks');
            } else {
                alert('提交作业失败，请重试');
            }
        } catch (error) {
            console.error('提交作业失败:', error);
            alert('提交作业失败，请重试');
        } finally {
            setSubmitting(false);
        }
    };

    // 返回按钮处理
    const handleBack = () => {
        if (isPreview && isTeacher) {
            // 教师预览模式返回作业管理页面
            navigate('/homework-management');
        } else {
            // 学生模式返回任务列表
            navigate('/tasks');
        }
    };

    if (loading) {
        return <LoaderComponent>正在加载作业内容……</LoaderComponent>;
    }

    if (!homework) {
        return (
            <Paper p="xl">
                <Text color="red">作业不存在</Text>
                <Button onClick={handleBack} mt="md">
                    返回
                </Button>
            </Paper>
        );
    }

    return (
        <>
            <Stack p="md" mt="20px">
                <HomeworkHeader
                    title={homework.title}
                    language={form.values.language}
                    onLanguageChange={(value) => form.setFieldValue('language', value)}
                    onResetToOriginal={handleResetToOriginal}
                    onResetToPreviousSubmission={handleResetToPreviousSubmission}
                    hasPreviousSubmission={hasPreviousSubmission}
                    isLanguageEditable={homework.language === '*' && !isPreview}
                    previewMode={isPreview}
                    onBack={handleBack}
                />

                <Grid>
                    <Grid.Col span={{ base: 12, md: 6, lg: 6 }}>
                        <HomeworkDescription description={homework.description} />
                    </Grid.Col>

                    <Grid.Col span={{ base: 12, md: 6, lg: 6 }}>
                        <Group justify="space-between" mb="md">
                            <Title order={4}>代码编辑</Title>
                            <Text size="sm" c="dimmed">
                                {isPreview ? '预览模式' :
                                    hasPreviousSubmission ? '编辑已提交的作业' : '新作业'}
                            </Text>
                        </Group>

                        <CodeEditorTabs
                            files={files}
                            fileContents={fileContents}
                            activeFile={activeFile}
                            language={form.values.language}
                            onFileChange={handleFileContentChange}
                            onActiveFileChange={setActiveFile}
                            onAddFile={handleAddFile}
                            onDeleteFile={handleDeleteFile}
                            onFileNameEdit={handleFileNameEdit}
                        />
                    </Grid.Col>
                </Grid>

                <CompileOptionsPanel
                    compileOptions={form.values.compileOptions}
                    onCompileOptionsChange={(value) => form.setFieldValue('compileOptions', value)}
                    stdin={form.values.stdin}
                    onStdinChange={(value) => form.setFieldValue('stdin', value)}
                    hasPresetCompileOptions={!!homework.compile_options}
                />

                <RunResultPanel
                    runResult={runResult}
                    running={running}
                    testing={testing}
                    submitting={submitting}
                    hasPreviousSubmission={hasPreviousSubmission}
                    hasTestCases={hasTestCases}
                    onRunCode={handleRunCode}
                    onTestCode={handleTestCode}
                    onSubmit={handleSubmit}
                    previewMode={isPreview}
                />

                {!isPreview && (
                    <SubmissionModals
                        noRunOpened={noRunOpened}
                        onNoRunClose={closeNoRun}
                        testWarningOpened={testWarningOpened}
                        onTestWarningClose={closeTestWarning}
                        submitting={submitting}
                        runResult={runResult}
                        hasTestCases={hasTestCases}
                        onSubmit={submitHomework}
                    />
                )}
            </Stack>
            <Modal opened={selectLanguageModalOpened}
                onClose={selectLanguageModalClose}
                title="请选择编程语言">
                <Text>请先选择编程语言。</Text>
                <Group justify="flex-end">
                    <Button onClick={selectLanguageModalClose} loading={submitting}>
                        确认
                    </Button>
                </Group>
            </Modal>
        </>
    );
}