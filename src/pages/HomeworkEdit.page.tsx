// HomeworkEditPage.tsx
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { IconArrowLeft, IconRefresh, IconRun, IconSend } from '@tabler/icons-react';
import {
    Button,
    Paper,
    Stack,
    Group,
    Title,
    Text,
    Select,
    Modal,
    Code,
    Tabs,
    useMantineColorScheme,
    MantineColorScheme,
    Tooltip,
    ActionIcon,
    Grid,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useForm } from '@mantine/form';
import MDEditor from '@uiw/react-md-editor';
import { useAuth } from '@/App';

interface HomeworkFile {
    id: bigint;
    homework_id: bigint;
    file_name: string;
    file_content: string;
    editable: boolean;
}

interface HomeworkDetails {
    id: bigint;
    course_id: bigint;
    title: string;
    description: string;
    deadline: string;
    course_name: string;
    language: string;
    result?: string;
}

interface RunResult {
    success: boolean;
    output: string;
    error?: string;
    signal?: string;
    status?: string;
}

interface UserProfile {
    id: string;
    name: string;
    student_id: string;
    class_id: number;
}

const LANGUAGE_OPTIONS = [
    { value: 'cpp', label: 'C++' },
    { value: 'java', label: 'Java' },
    { value: 'python', label: 'Python' },
    { value: 'csharp', label: 'C#' },
    { value: 'go', label: 'Go' },
    { value: 'haskell', label: 'Haskell' },
];

export default function HomeworkEditPage() {
    const { id: homeworkId } = useParams();
    const navigate = useNavigate();
    const { supabaseClient: supabase } = useAuth();

    const [homework, setHomework] = useState<HomeworkDetails | null>(null);
    const [files, setFiles] = useState<HomeworkFile[]>([]);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [running, setRunning] = useState(false);
    const [runResult, setRunResult] = useState<RunResult | null>(null);
    const [activeFile, setActiveFile] = useState<string | null>(null);
    const [fileContents, setFileContents] = useState<Record<string, string>>({});
    const [initialFileContents, setInitialFileContents] = useState<Record<string, string>>({});
    const [submittedFileContents, setSubmittedFileContents] = useState<Record<string, string>>({});
    const [hasPreviousSubmission, setHasPreviousSubmission] = useState(false);

    const [opened, { open, close }] = useDisclosure(false);
    const { colorScheme } = useMantineColorScheme();

    const form = useForm({
        initialValues: {
            language: '',
        },
    });

    useEffect(() => {
        if (homeworkId) {
            fetchHomeworkData();
        }
    }, [homeworkId]);

    const fetchHomeworkData = async () => {
        try {
            setLoading(true);

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('用户未登录');

            // 获取用户信息
            const { data: profileData } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            if (!profileData) throw new Error('用户信息不存在');
            setProfile(profileData);

            // 获取作业详情
            const { data: homeworkData } = await supabase
                .from('homeworks')
                .select(`
          *,
          courses(name, language)
        `)
                .eq('id', homeworkId)
                .single();

            if (!homeworkData) throw new Error('作业不存在');

            const homeworkDetails: HomeworkDetails = {
                id: homeworkData.id,
                course_id: homeworkData.course_id,
                title: homeworkData.title,
                description: homeworkData.description,
                deadline: homeworkData.deadline,
                course_name: homeworkData.courses.name,
                language: homeworkData.courses.language,
            };

            setHomework(homeworkDetails);

            // 设置语言
            const language = homeworkData.courses.language === '*' ? 'cpp' : homeworkData.courses.language;
            form.setFieldValue('language', language);

            // 获取作业文件
            const { data: filesData } = await supabase
                .from('homework_files')
                .select('*')
                .eq('homework_id', homeworkId)
                .order('id');

            if (filesData) {
                setFiles(filesData);

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
            }

            // 检查是否有之前的提交
            await checkPreviousSubmission(user.id);

        } catch (error) {
            console.error('获取作业数据失败:', error);
        } finally {
            setLoading(false);
        }
    };

    const checkPreviousSubmission = async (userId: string) => {
        try {
            // 检查 URL 参数中是否有 answer_id
            const searchParams = new URLSearchParams(window.location.search);
            const answerId = searchParams.get('answer_id');

            let answerData;

            if (answerId) {
                // 如果有 answer_id，获取特定的答案记录
                const { data } = await supabase
                    .from('answers')
                    .select('*')
                    .eq('id', answerId)
                    .eq('student_id', userId)
                    .single();
                answerData = data;
            } else {
                // 否则获取最新的答案记录
                const { data } = await supabase
                    .from('answers')
                    .select('*')
                    .eq('homework_id', homeworkId)
                    .eq('student_id', userId)
                    .order('submitted_at', { ascending: false })
                    .limit(1)
                    .single();
                answerData = data;
            }

            if (answerData && answerData.storage_path) {
                // 从存储中加载已提交的文件
                await loadSubmittedFiles(answerData.storage_path);
                setHasPreviousSubmission(true);
                console.log('发现之前的提交，已加载文件');
            } else {
                console.log('没有发现之前的提交');
            }
        } catch (error) {
            console.error('检查之前提交失败:', error);
        }
    };

    const loadSubmittedFiles = async (storagePath: string) => {
        try {
            // 列出存储路径下的所有文件
            const { data: filesList, error: listError } = await supabase.storage
                .from('homework')
                .list(storagePath);

            if (listError) {
                console.error('列出文件失败:', listError);
                throw listError;
            }

            console.log('找到的文件列表:', filesList);

            if (filesList && filesList.length > 0) {
                const submittedContents: Record<string, string> = {};

                // 下载每个文件的内容
                for (const file of filesList) {
                    const filePath = `${storagePath}/${file.name}`;
                    console.log('正在下载文件:', filePath);

                    const { data: signed, error: signError } = await supabase.storage
                     .from('homework').createSignedUrl(filePath, 30);
                    
                    if (signError || !signed?.signedUrl) continue;

                    const resp = await fetch(signed.signedUrl);
                    const text = await resp.text();

                    submittedContents[file.name] = text;
                }

                setSubmittedFileContents(submittedContents);

                // 如果有提交的文件内容，使用它们
                if (Object.keys(submittedContents).length > 0) {
                    setFileContents(submittedContents);
                    console.log('已设置提交的文件内容');
                }
            } else {
                console.log('存储路径下没有找到文件');
            }
        } catch (error) {
            console.error('加载已提交文件失败:', error);
        }
    };

    const handleFileContentChange = (fileName: string, content: string) => {
        setFileContents(prev => ({
            ...prev,
            [fileName]: content
        }));
    };

    const handleLoadPreviousSubmission = () => {
        if (Object.keys(submittedFileContents).length > 0) {
            setFileContents({ ...submittedFileContents });
            console.log('已加载之前提交的内容');
        } else {
            console.log('没有可用的之前提交内容');
        }
    };

    const handleResetToOriginal = () => {
        setFileContents({ ...initialFileContents });
        console.log('已重置到原始文件');
    };

    const handleResetToPreviousSubmission = () => {
        if (Object.keys(submittedFileContents).length > 0) {
            setFileContents({ ...submittedFileContents });
            console.log('已重置到之前提交的内容');
        } else {
            console.log('没有可用的之前提交内容');
        }
    };

    const getCompilerName = (language: string): string => {
        const compilerMap: Record<string, string> = {
            'cpp': 'gcc-13.2.0',
            'java': 'OpenJDK jdk-22+36',
            'python': 'CPython 3.14.0',
            'csharp': 'mcs 6.12.0.199',
            'go': 'go 1.23.2',
            'haskell': 'ghc 9.10.1',
        };
        return compilerMap[language] || 'gcc-13.2.0';
    };

    const handleSubmit = async () => {
        if (!runResult) {
            open();
            return;
        }
        await submitHomework();
    };

    const submitHomework = async () => {
        if (!homework || !profile) return;

        setSubmitting(true);
        close();

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('用户未登录');

            // 构建存储路径 - 移除结尾的斜杠
            const userid = user.id;
            const storagePath = `${userid}/${homework.id}`; // 移除结尾的斜杠

            // 上传文件到存储
            for (const [fileName, content] of Object.entries(fileContents)) {
                const filePath = `${storagePath}/${fileName}`;
                console.log('上传文件路径:', filePath);

                const { error: uploadError } = await supabase.storage
                    .from('homework')
                    .upload(filePath, new Blob([content], { type: 'text/plain' }), {
                        upsert: true,
                        cacheControl: 'no-cache',
                    });

                if (uploadError) {
                    console.error(`上传文件 ${fileName} 失败:`, uploadError);
                    throw uploadError;
                }
                console.log(`文件 ${fileName} 上传成功`);
            }

            // 创建或更新答案记录 - 明确设置 submitted_at
            const { error: answerError } = await supabase
                .from('answers')
                .upsert({
                    homework_id: homework.id,
                    student_id: user.id,
                    storage_path: storagePath,
                    submitted_at: new Date().toISOString(), // 明确设置提交时间
                    result: homework.result,
                }, {
                    onConflict: 'homework_id,student_id'
                });

            if (answerError) {
                console.error('更新答案记录失败:', answerError);
                throw answerError;
            }
            setSubmittedFileContents({ ...fileContents });
            setHasPreviousSubmission(true);
            setTimeout(() => {
                navigate('/tasks');
            }, 500);

        } catch (error) {
            console.error('提交作业失败:', error);
            alert('提交作业失败，请重试');
        } finally {
            setSubmitting(false);
        }
    };

    const handleRunCode = async () => {
        if (!form.values.language) {
            alert('请选择编程语言');
            return;
        }

        setRunning(true);
        setRunResult(null);

        try {
            const wandboxData = {
                compiler: getCompilerName(form.values.language),
                code: '',
                codes: Object.entries(fileContents).map(([fileName, content]) => ({
                    file: fileName,
                    code: content
                })),
                options: "",
                stdin: "",
                compiler_option_raw: "-O2 -std=c++17", // 根据语言调整编译选项
                runtime_option_raw: ""
            };

            const mainFile = files.find(file => file.file_name.startsWith('prog.'));

            if (mainFile) {
                wandboxData.code = fileContents[mainFile.file_name];
            } else if (Object.keys(fileContents).length > 0) {
                // 如果没有明确的主文件，使用第一个文件
                const firstFileName = Object.keys(fileContents)[0];
                wandboxData.code = fileContents[firstFileName];
            }

            const response = await fetch('https://wandbox.org/api/compile.json', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(wandboxData),
            });

            if (!response.ok) {
                throw new Error(`网络请求失败: ${response.status} ${response.statusText}`);
            }

            const result = await response.json();
            console.log('Wandbox 返回结果:', result);

            const output = result.program_output || result.compiler_output || '程序运行完成，无输出内容';

            // 处理 Wandbox 返回结果
            setRunResult({
                success: result.status === '0',
                output,
                error: result.program_error || result.compiler_error,
                signal: result.signal,
                status: result.status
            });

            setHomework((old) => old ? { ...old, result: output } : old);

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

    if (loading) {
        return (
            <LoaderComponent>正在加载作业内容……</LoaderComponent>
        );
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

    return (
        <Stack p="md" mt="20px">
            {/* 头部 */}
            <Group>
                <Button
                    variant="subtle"
                    leftSection={<IconArrowLeft size={16} />}
                    onClick={() => navigate('/tasks')}
                >
                    返回
                </Button>
                <Title order={3}>{homework.title}</Title>

                <Group style={{ marginLeft: 'auto' }}>
                    {/* 重置到原始文件按钮 */}
                    <Tooltip label="重置到原始文件">
                        <ActionIcon
                            variant="light"
                            color="blue"
                            onClick={handleResetToOriginal}
                            size="lg"
                        >
                            <IconRefresh size={18} />
                        </ActionIcon>
                    </Tooltip>

                    {/* 重置到之前提交按钮 */}
                    {hasPreviousSubmission && (
                        <Tooltip label="重置到之前提交">
                            <ActionIcon
                                variant="light"
                                color="orange"
                                onClick={handleResetToPreviousSubmission}
                                size="lg"
                            >
                                <IconRefresh size={18} />
                            </ActionIcon>
                        </Tooltip>
                    )}

                    <Select
                        data={LANGUAGE_OPTIONS}
                        value={form.values.language}
                        onChange={(value) => form.setFieldValue('language', value || '')}
                        disabled={homework.language !== '*'}
                    />
                </Group>
            </Group>

            {/* 主要内容区域 */}
            <Grid>
                {/* 左侧：作业描述 */}
                <Grid.Col span={{ base: 12, md: 6, lg: 6 }}>
                    <Title order={4} mb="md">作业描述</Title>
                    <div data-color-mode={colorScheme}>
                        <MDEditor.Markdown
                            source={homework.description}
                            style={{
                                whiteSpace: 'pre-wrap',
                                backgroundColor: 'transparent'
                            }}
                        />
                    </div>
                </Grid.Col>

                {/* 右侧：代码编辑器 */}
                <Grid.Col span={{ base: 12, md: 6, lg: 6 }}>
                    <Group justify="space-between" mb="md">
                        <Title order={4}>代码编辑</Title>
                        <Text size="sm" c="dimmed">
                            {hasPreviousSubmission ? '编辑已提交的作业' : '新作业'}
                        </Text>
                    </Group>

                    {files.length > 0 ? (
                        <Tabs value={activeFile} onChange={setActiveFile}>
                            <Tabs.List>
                                {files.map(file => (
                                    <Tabs.Tab key={file.id.toString()} value={file.file_name}>
                                        {file.file_name}
                                        {!file.editable && (
                                            <Text component="span" c="dimmed" ml={4} size="xs">
                                                (只读)
                                            </Text>
                                        )}
                                    </Tabs.Tab>
                                ))}
                            </Tabs.List>

                            {files.map(file => (
                                <Tabs.Panel key={file.id.toString()} value={file.file_name}>
                                    <CodeEditor
                                        value={fileContents[file.file_name] || ''}
                                        onChange={(value) => handleFileContentChange(file.file_name, value || '')}
                                        language={form.values.language}
                                        readOnly={!file.editable}
                                        height="400px"
                                        colorScheme={colorScheme}
                                    />
                                </Tabs.Panel>
                            ))}
                        </Tabs>
                    ) : (
                        <Text c="dimmed">暂无文件</Text>
                    )}
                </Grid.Col>
            </Grid>

            {/* 运行结果和操作按钮 */}
            <Paper p="md">
                <Stack>
                    <Title order={4}>运行结果</Title>

                    {runResult && (
                        <Paper p="md" withBorder>
                            <Group mb="sm">
                                <Text fw={500} color={runResult.success ? 'green' : 'red'}>
                                    {runResult.success ? '运行成功' : '运行失败'}
                                </Text>
                                {runResult.status && (
                                    <Text size="sm" c="dimmed">
                                        状态码: {runResult.status}
                                    </Text>
                                )}
                            </Group>
                            {runResult.output && (
                                <div>
                                    <Text fw={500} size="sm" mb="xs">输出:</Text>
                                    <Code block style={{ whiteSpace: 'pre-wrap', maxHeight: '200px', overflow: 'auto' }}>
                                        {runResult.output}
                                    </Code>
                                </div>
                            )}
                            {runResult.error && (
                                <div>
                                    <Text fw={500} size="sm" color="red" mb="xs">错误信息:</Text>
                                    <Code block color="red" style={{ whiteSpace: 'pre-wrap', maxHeight: '200px', overflow: 'auto' }}>
                                        {runResult.error}
                                    </Code>
                                </div>
                            )}
                        </Paper>
                    )}

                    <Group justify="flex-end">
                        <Button
                            leftSection={<IconRun size={16} />}
                            onClick={handleRunCode}
                            loading={running}
                            variant="light"
                        >
                            运行代码
                        </Button>
                        <Button
                            leftSection={<IconSend size={16} />}
                            onClick={handleSubmit}
                            loading={submitting}
                            disabled={running}
                        >
                            {hasPreviousSubmission ? '更新提交' : '提交作业'}
                        </Button>
                    </Group>
                </Stack>
            </Paper>

            {/* 确认提交模态框 */}
            <Modal opened={opened} onClose={close} title="确认提交" centered>
                <Text mb="md">您还没有运行代码，是否确认提交？</Text>
                <Group justify="flex-end">
                    <Button variant="subtle" onClick={close}>
                        取消
                    </Button>
                    <Button onClick={submitHomework} loading={submitting}>
                        确认提交
                    </Button>
                </Group>
            </Modal>
        </Stack>
    );
}

// Monaco 编辑器组件
import Editor from '@monaco-editor/react';
import LoaderComponent from '@/components/LoaderComponent';

interface CodeEditorProps {
    value: string;
    onChange: (value: string | undefined) => void;
    language: string;
    readOnly?: boolean;
    height?: string;
    colorScheme?: MantineColorScheme;
}

function CodeEditor({ value, onChange, language, readOnly = false, height = '400px', colorScheme = 'light' }: CodeEditorProps) {
    const editorLanguageMap: Record<string, string> = {
        'cpp': 'cpp',
        'java': 'java',
        'python': 'python',
        'csharp': 'csharp',
        'go': 'go',
        'haskell': 'haskell',
    };

    return (
        <Editor
            height={height}
            language={editorLanguageMap[language] || 'plaintext'}
            value={value}
            onChange={onChange}
            width="100%"
            options={{
                readOnly,
                minimap: { enabled: false },
                fontSize: 14,
                wordWrap: 'on',
                automaticLayout: true,
                scrollBeyondLastLine: false,
            }}
            theme={colorScheme === 'dark' ? 'vs-dark' : 'vs'}
        />
    );
}