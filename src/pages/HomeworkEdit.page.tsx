// pages/HomeworkEdit.page.tsx
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Stack, Grid, Group, Text, Paper, Button, Title, Modal } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useForm } from '@mantine/form';
import { useAuth } from '@/App';
import { useMantineColorScheme } from '@mantine/core';
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
    HomeworkFile,
    UserProfile
} from '@/lib/database';

export default function HomeworkEditPage() {
    const { id: homeworkId } = useParams();
    const navigate = useNavigate();
    const { supabaseClient: supabase } = useAuth();
    const { colorScheme } = useMantineColorScheme();

    const [homework, setHomework] = useState<HomeworkDetails | null>(null);
    const [originalFiles, setOriginalFiles] = useState<HomeworkFile[]>([]);
    const [customFiles, setCustomFiles] = useState<CustomFile[]>([]);
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

    const getAllFiles = () => {
        return [...originalFiles, ...customFiles];
    };

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

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('用户未登录');

            const profileData = await fetchUserProfile(supabase, user.id);
            if (!profileData) throw new Error('用户信息不存在');
            setProfile(profileData);

            const homeworkData = await fetchHomeworkData(supabase, homeworkId!);
            if (!homeworkData) throw new Error('作业不存在');

            const { homework: homeworkDetails, files: filesData } = homeworkData;
            setHomework(homeworkDetails);
            setOriginalFiles(filesData);

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

            // 检查是否有之前的提交
            const submission = await checkPreviousSubmission(supabase, homeworkId!, user.id);
            if (submission.hasSubmission && submission.storagePath) {
                const submittedContents = await loadSubmittedFiles(supabase, submission.storagePath);
                setSubmittedFileContents(submittedContents);
                if (Object.keys(submittedContents).length > 0) {
                    setFileContents(submittedContents);
                }
                setHasPreviousSubmission(true);
            }

        } catch (error) {
            console.error('获取作业数据失败:', error);
        } finally {
            setLoading(false);
        }
    };

    // 文件操作函数
    const handleAddFile = () => {
        if (form.values.language === '') {
            selectLanguageModalOpen();
            return;
        }
        const extension = FILE_EXTENSIONS[form.values.language] || '.txt';
        const newFileName = `new_file${customFiles.length + 1}${extension}`;
        const newFile: CustomFile = {
            id: `custom-${Date.now()}`,
            file_name: newFileName,
            file_content: '',
            editable: true,
            isCustom: true,
        };

        setCustomFiles(prev => [...prev, newFile]);
        setFileContents(prev => ({
            ...prev,
            [newFileName]: ''
        }));
        setActiveFile(newFileName);
    };

    const handleDeleteFile = (fileName: string) => {
        const originalFile = originalFiles.find(f => f.file_name === fileName);
        if (originalFile && !originalFile.editable) {
            alert('无法删除只读文件');
            return;
        }

        setCustomFiles(prev => prev.filter(file => file.file_name !== fileName));
        setFileContents(prev => {
            const newContents = { ...prev };
            delete newContents[fileName];
            return newContents;
        });

        if (activeFile === fileName) {
            const allFiles = getAllFiles();
            const remainingFiles = allFiles.filter(f => f.file_name !== fileName);
            setActiveFile(remainingFiles.length > 0 ? remainingFiles[0].file_name : null);
        }
    };

    const handleFileNameEdit = (oldFileName: string, newFileName: string) => {
        setCustomFiles(prev => prev.map(file =>
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
        setCustomFiles([]);
    };

    const handleResetToPreviousSubmission = () => {
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
                fileContents
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

    if (loading) {
        return <LoaderComponent>正在加载作业内容……</LoaderComponent>;
    }

    if (!homework) {
        return (
            <Paper p="xl">
                <Text color="red">作业不存在</Text>
                <Button onClick={() => navigate('/tasks')} mt="md">
                    返回
                </Button>
            </Paper>
        );
    }

    const allFiles = getAllFiles();

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
                    isLanguageEditable={homework.language === '*'}
                />

                <Grid>
                    <Grid.Col span={{ base: 12, md: 6, lg: 6 }}>
                        <HomeworkDescription
                            description={homework.description}
                            colorScheme={colorScheme}
                        />
                    </Grid.Col>

                    <Grid.Col span={{ base: 12, md: 6, lg: 6 }}>
                        <Group justify="space-between" mb="md">
                            <Title order={4}>代码编辑</Title>
                            <Text size="sm" c="dimmed">
                                {hasPreviousSubmission ? '编辑已提交的作业' : '新作业'}
                            </Text>
                        </Group>

                        <CodeEditorTabs
                            files={allFiles}
                            fileContents={fileContents}
                            activeFile={activeFile}
                            language={form.values.language}
                            colorScheme={colorScheme}
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
                />

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