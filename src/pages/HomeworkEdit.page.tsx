// pages/HomeworkEdit.page.tsx - 更新版本
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Container,
    Paper,
    Title,
    Button,
    Stack,
    Tabs,
    LoadingOverlay,
    Group,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useAuth } from '@/App';
import { HomeworkFileManager } from '@/components/HomeworkFileManager';
import { TestCaseManager } from '@/components/TestCaseManager';
import { CompileOptionsPanel } from '@/components/CompileOptionsPanel';
import { HomeworkEditor } from '@/components/HomeworkEditor';

interface Course {
    id: number;
    name: string;
    language: string;
}

interface Homework {
    id: number;
    title: string;
    course_id: number;
    description: string;
    deadline: string;
    published: boolean;
    compile_options?: string;
    inputs?: string[];
    outputs?: string[];
}

// 导出表单值类型供 HomeworkEditor 使用
export interface HomeworkFormValues {
    title: string;
    course_id: string;
    description: string;
    deadline: Date | null;
    published: boolean;
    compile_options?: string;
}

const HomeworkEditPage: React.FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { supabaseClient: supabase } = useAuth();
    const [courses, setCourses] = useState<Course[]>([]);
    const [homework, setHomework] = useState<Homework | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const form = useForm<HomeworkFormValues>({
        initialValues: {
            title: '',
            course_id: '',
            description: '',
            deadline: null,
            compile_options: '',
            published: false,
        },
    });

    useEffect(() => {
        if (id) {
            fetchHomeworkData();
        }
        fetchCourses();
    }, [id]);

    const fetchHomeworkData = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('homeworks')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;

            setHomework(data);
            form.setValues({
                title: data.title,
                course_id: data.course_id.toString(),
                description: data.description,
                deadline: new Date(data.deadline),
                compile_options: data.compile_options || '',
                published: data.published,
            });
        } catch (err: any) {
            console.error('获取作业数据失败:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchCourses = async () => {
        try {
            const { data, error } = await supabase
                .from('courses')
                .select('id, name, language')
                .eq('active', true);

            if (error) throw error;
            setCourses(data || []);
        } catch (err: any) {
            console.error('获取课程失败:', err);
        }
    };

    const handleSave = async (publish: boolean) => {
        try {
            setSaving(true);

            const homeworkData = {
                title: form.values.title,
                course_id: parseInt(form.values.course_id),
                description: form.values.description,
                deadline: form.values.deadline?.toISOString(),
                compile_options: form.values.compile_options,
                published: publish,
            };

            const { error } = await supabase
                .from('homeworks')
                .update(homeworkData)
                .eq('id', id);

            if (error) throw error;

            navigate('/');
        } catch (err: any) {
            console.error('保存作业失败:', err);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <Container size="xl" py="xl">
                <LoadingOverlay visible={loading} />
            </Container>
        );
    }

    return (
        <Container size="xl" py="xl">
            <Stack>
                <Group justify="space-between">
                    <Title order={2}>编辑作业</Title>
                    <Button
                        variant="outline"
                        onClick={() => navigate('/')}
                    >
                        返回管理
                    </Button>
                </Group>

                <Paper withBorder>
                    <Tabs defaultValue="basic">
                        <Tabs.List>
                            <Tabs.Tab value="basic">基本信息</Tabs.Tab>
                            <Tabs.Tab value="files">代码文件</Tabs.Tab>
                            <Tabs.Tab value="compile">编译选项</Tabs.Tab>
                            <Tabs.Tab value="tests">测试用例</Tabs.Tab>
                        </Tabs.List>

                        <Tabs.Panel value="basic">
                            <HomeworkEditor
                                form={form}
                                courses={courses}
                                onSave={handleSave}
                                onCancel={() => navigate('/')}
                                saving={saving}
                            />
                        </Tabs.Panel>

                        <Tabs.Panel value="files">
                            <HomeworkFileManager homeworkId={id!} />
                        </Tabs.Panel>

                        <Tabs.Panel value="compile">
                            <Stack p="xl">
                                <Title order={3}>编译选项</Title>
                                <CompileOptionsPanel
                                    compileOptions={form.values.compile_options || ''}
                                    onCompileOptionsChange={(value) => form.setFieldValue('compile_options', value)}
                                    stdin=""
                                    onStdinChange={() => { }}
                                    hasPresetCompileOptions={false}
                                />
                                <Group justify="flex-end">
                                    <Button onClick={() => handleSave(form.values.published)}>
                                        保存编译选项
                                    </Button>
                                </Group>
                            </Stack>
                        </Tabs.Panel>

                        <Tabs.Panel value="tests">
                            <TestCaseManager homeworkId={id!} />
                        </Tabs.Panel>
                    </Tabs>
                </Paper>
            </Stack>
        </Container>
    );
};

export default HomeworkEditPage;