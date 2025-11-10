// pages/HomeworkCreate.page.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Container,
    Paper,
    Title,
    Stack,
    LoadingOverlay,
    Notification,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useAuth } from '@/App';
import { HomeworkEditor } from '@/components/HomeworkEditor';
import { HomeworkFormValues } from './HomeworkEdit.page';

interface Course {
    id: number;
    name: string;
    language: string;
}

const HomeworkCreatePage: React.FC = () => {
    const navigate = useNavigate();
    const { supabaseClient: supabase } = useAuth();
    const [courses, setCourses] = useState<Course[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const form = useForm<HomeworkFormValues>({
        initialValues: {
            title: '',
            course_id: '',
            description: '# 作业描述\n\n请在此处编写作业描述...',
            deadline: null,
            published: false,
            compile_options: '',
        },
        validate: {
            title: (value) => (value.trim().length < 2 ? '作业标题至少需要2个字符' : null),
            course_id: (value) => (!value ? '请选择课程' : null),
            description: (value) => (value.trim().length < 10 ? '作业描述至少需要10个字符' : null),
            deadline: (value) => (!value ? '请设置截止时间' : null),
        },
    });

    useEffect(() => {
        fetchCourses();
    }, []);

    const fetchCourses = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('courses')
                .select('id, name, language')
                .eq('active', true);

            if (error) throw error;
            setCourses(data || []);
        } catch (err: any) {
            console.error('获取课程失败:', err);
            setError(`获取课程失败: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const saveHomework = async (publish: boolean) => {
        const validation = form.validate();
        if (validation.hasErrors) {
            console.log('表单验证失败:', validation.errors);
            return;
        }

        try {
            setSaving(true);
            setError(null);

            let deadlineISO: string | null = null;
            if (form.values.deadline) {
                if (form.values.deadline instanceof Date) {
                    deadlineISO = form.values.deadline.toISOString();
                } else {
                    deadlineISO = new Date(form.values.deadline).toISOString();
                }
            }

            const homeworkData = {
                title: form.values.title,
                course_id: parseInt(form.values.course_id),
                description: form.values.description,
                deadline: deadlineISO,
                published: publish,
                compile_options: form.values.compile_options,
            };

            const { data, error } = await supabase
                .from('homeworks')
                .insert([homeworkData])
                .select();

            if (error) {
                console.error('数据库错误:', error);
                throw error;
            }

            if (data && data[0]) {
                navigate('/homework-management');
            }
        } catch (err: any) {
            console.error('保存作业失败:', err);
            setError(`保存作业失败: ${err.message}`);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Container size="xl" py="xl">
            <Paper withBorder p="xl">
                <LoadingOverlay visible={loading} />
                <Stack>
                    <Title order={2}>创建新作业</Title>

                    {error && (
                        <Notification color="red" onClose={() => setError(null)}>
                            {error}
                        </Notification>
                    )}

                    <HomeworkEditor
                        form={form}
                        courses={courses}
                        onSave={saveHomework}
                        onCancel={() => navigate('/homework-management')} // 修复导航路径
                        saving={saving}
                    />
                </Stack>
            </Paper>
        </Container>
    );
};

export default HomeworkCreatePage;