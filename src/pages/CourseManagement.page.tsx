// pages/CourseManagement.page.tsx
import React, { useState, useEffect } from 'react';
import {
    Table,
    Button,
    TextInput,
    Select,
    MultiSelect,
    Checkbox,
    Paper,
    Title,
    Container,
    ActionIcon,
    Modal,
    Text,
    Badge,
    Stack,
    LoadingOverlay,
    Notification,
    Flex,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconEdit, IconTrash, IconPlus, IconSchool, IconUsers, IconDownload } from '@tabler/icons-react';
import { useAuth } from '../App';
import LoaderComponent from '@/components/LoaderComponent';
import { LANGUAGE_OPTIONS } from '@/lib/wandbox';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import {
    initializeTypst,
    loadTypstScript,
    generateTypstSource,
    generatePdf
} from '@/lib/typst';
import {
    Class, Course, fetchCourseHomeworks, fetchCourses,
    fetchCourseStudents, fetchFileContents,
    fetchStudentCheckRecords, HomeworkInfo, Review, StudentInfo
} from '@/lib/database';

interface CourseFormValues {
    name: string;
    language: string;
    class_ids: number[];
    active: boolean;
}

interface ClassFormValues {
    name: string;
    active: boolean;
}

const CourseManagementPage: React.FC = () => {
    const { supabaseClient, userRole } = useAuth();
    const [courses, setCourses] = useState<Course[]>([]);
    const [classes, setClasses] = useState<Class[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [exportingCourse, setExportingCourse] = useState<number | null>(null);

    // 模态框状态
    const [courseModalOpened, setCourseModalOpened] = useState(false);
    const [classModalOpened, setClassModalOpened] = useState(false);
    const [editingCourse, setEditingCourse] = useState<Course | null>(null);
    const [deletingCourse, setDeletingCourse] = useState<Course | null>(null);

    // 课程表单
    const courseForm = useForm<CourseFormValues>({
        initialValues: {
            name: '',
            language: 'cpp',
            class_ids: [],
            active: true,
        },
        validate: {
            name: (value) => (value.trim().length < 2 ? '课程名称至少需要2个字符' : null),
        },
    });

    // 班级表单
    const classForm = useForm<ClassFormValues>({
        initialValues: {
            name: '',
            active: true,
        },
        validate: {
            name: (value) => (value.trim().length < 1 ? '班级名称不能为空' : null),
        },
    });

    // 初始化数据
    useEffect(() => {
        const getCoursesAndClasses = async () => {
            if (userRole === 'teacher') {
                setLoading(true);
                const cs = await fetchCourses(supabaseClient);
                setCourses(cs);
                fetchClasses();
                setLoading(false);
            }
        }
        getCoursesAndClasses();
    }, [userRole]);

    // 重置表单
    const resetCourseForm = () => {
        courseForm.reset();
        setEditingCourse(null);
    };

    // 打开编辑课程模态框
    const openEditCourseModal = (course: Course) => {
        setEditingCourse(course);
        courseForm.setValues({
            name: course.name,
            language: course.language,
            class_ids: course.class_ids || [],
            active: course.active,
        });
        setCourseModalOpened(true);
    };


    const fetchClasses = async () => {
        try {
            const { data, error } = await supabaseClient
                .from('classes')
                .select('*')
                .order('name');

            if (error) {
                console.error('获取班级失败:', error);
                throw error;
            }

            setClasses(data || []);
        } catch (err: any) {
            console.error('获取班级失败:', err);
            setError(`获取班级失败: ${err.message}`);
        }
    };

    // 生成CSV文件内容
    const generateCSV = (students: StudentInfo[], homeworks: HomeworkInfo[], gradesData: any[]): string => {
        const headers = ['姓名', '学号', '班级'];
        homeworks.forEach(hw => headers.push(hw.title));

        const csvRows = [headers.join(',')];

        students.forEach(student => {
            const row = [
                student.name,
                student.student_id,
                student.class_name
            ];

            homeworks.forEach(hw => {
                const grade = gradesData.find(g =>
                    g.studentId === student.id && g.homeworkId === hw.id
                )?.grade || '未批改';
                row.push(grade);
            });

            csvRows.push(row.join(','));
        });

        return csvRows.join('\n');
    };

    // 导出课程数据
    const handleExportCourse = async (course: Course) => {
        try {
            setExportingCourse(course.id);
            setError(null);

            // 确保 Typst 已初始化
            if (!window.$typst || !window.$typst.__initialized) {
                await loadTypstScript();
                await initializeTypst({
                    onError: (errorMsg) => {
                        throw new Error(`Typst 初始化失败: ${errorMsg}`);
                    }
                });
            }

            // 获取课程相关数据
            const students = await fetchCourseStudents(supabaseClient, course.id);
            const homeworks = await fetchCourseHomeworks(supabaseClient, course.id);

            if (students.length === 0 || homeworks.length === 0) {
                setError('该课程没有学生或作业数据');
                setExportingCourse(null);
                return;
            }

            const zip = new JSZip();
            const gradesData: any[] = [];

            // 为每个班级创建文件夹
            const classFolders: { [key: number]: any } = {};
            students.forEach(student => {
                if (!classFolders[student.class_id]) {
                    classFolders[student.class_id] = zip.folder(student.class_name);
                }
            });

            // 处理每个作业
            for (const homework of homeworks) {
                // 为每个作业在每个班级文件夹中创建子文件夹
                Object.keys(classFolders).forEach(classId => {
                    const classFolder = classFolders[parseInt(classId)];
                    classFolder.folder(homework.title);
                });

                // 处理每个学生的作业
                for (const student of students) {
                    const checkRecord = await fetchStudentCheckRecords(supabaseClient, student.id, homework.id);

                    if (checkRecord) {
                        // 记录成绩
                        gradesData.push({
                            studentId: student.id,
                            homeworkId: homework.id,
                            grade: checkRecord.grade
                        });

                        // 生成PDF
                        try {
                            const files = await fetchFileContents(supabaseClient, checkRecord.answers.storage_path!);

                            if (files.length > 0) {
                                const review: Review = {
                                    id: checkRecord.id,
                                    homework_title: checkRecord.answers.homeworks.title,
                                    description: checkRecord.answers.homeworks.description,
                                    course_name: checkRecord.answers.homeworks.courses.name,
                                    graded_at: checkRecord.created_at,
                                    grade: checkRecord.grade,
                                    total_comment: checkRecord.total_comment,
                                    comments: (checkRecord.comments_contents || []).map((content: string, index: number) => ({
                                        content,
                                        file: checkRecord.comments_files?.[index] || '',
                                        line: checkRecord.comments_lines?.[index] || 0
                                    })),
                                    storage_path: checkRecord.answers.storage_path!
                                };

                                const source = generateTypstSource(review, files);
                                const pdfData = await generatePdf(source);

                                // 添加到zip
                                const pdfFileName = `${student.name}-${student.student_id}.pdf`;
                                const classFolder = classFolders[student.class_id];
                                const homeworkFolder = classFolder.folder(homework.title);
                                homeworkFolder.file(pdfFileName, pdfData);
                            }
                        } catch (err) {
                            console.error(`生成学生 ${student.name} 的 PDF 失败:`, err);
                        }
                    }
                }
            }

            // 生成CSV文件
            const csvContent = generateCSV(students, homeworks, gradesData);
            zip.file('成绩汇总.csv', csvContent);

            // 生成并下载zip文件
            const zipContent = await zip.generateAsync({ type: 'blob' });
            saveAs(zipContent, `${course.name}-成绩汇总.zip`);

            setSuccess(`课程 ${course.name} 导出成功`);
        } catch (err: any) {
            console.error('导出课程失败:', err);
            setError(`导出课程失败: ${err.message}`);
        } finally {
            setExportingCourse(null);
        }
    };

    const handleCourseSubmit = async (values: CourseFormValues) => {
        try {
            setError(null);

            const user = await supabaseClient.auth.getUser();

            if (!user.data.user) {
                throw new Error('无法获取用户信息');
            }

            if (editingCourse) {
                // 更新现有课程
                const { error } = await supabaseClient
                    .from('courses')
                    .update({
                        name: values.name,
                        language: values.language,
                        class_ids: values.class_ids,
                        active: values.active
                    })
                    .eq('id', editingCourse.id)
                    .eq('teacher', user.data.user.id);

                if (error) {
                    console.error('更新课程错误:', error);
                    throw error;
                }
                setSuccess('课程更新成功');
            } else {
                // 创建新课程
                const { error } = await supabaseClient
                    .from('courses')
                    .insert({
                        name: values.name,
                        language: values.language,
                        class_ids: values.class_ids,
                        active: values.active,
                        teacher: user.data.user.id
                    });

                if (error) {
                    console.error('创建课程错误:', error);
                    throw error;
                }
                setSuccess('课程创建成功');
            }

            setCourseModalOpened(false);
            resetCourseForm();
            fetchCourses(supabaseClient);
        } catch (err: any) {
            console.error('操作失败:', err);
            setError(`操作失败: ${err.message}`);
        }
    };

    const handleClassSubmit = async (values: ClassFormValues) => {
        try {
            setError(null);

            const { error } = await supabaseClient
                .from('classes')
                .insert({
                    name: values.name,
                    active: values.active
                });

            if (error) throw error;

            setSuccess('班级创建成功');
            setClassModalOpened(false);
            classForm.reset();
            fetchClasses();
        } catch (err: any) {
            console.error('创建班级失败:', err);
            setError(`创建班级失败: ${err.message}`);
        }
    };

    // 删除课程 - 直接删除
    const handleDeleteCourse = async () => {
        if (!deletingCourse) return;

        try {
            setError(null);

            const { data: { user } } = await supabaseClient.auth.getUser();
            if (!user) throw new Error('用户未登录');

            const { error } = await supabaseClient
                .from('courses')
                .delete()
                .eq('id', deletingCourse.id)
                .eq('teacher', user.id);

            if (error) throw error;

            setSuccess('课程删除成功');
            setDeletingCourse(null);
            fetchCourses(supabaseClient);
        } catch (err: any) {
            console.error('删除失败:', err);
            setError(`删除失败: ${err.message}`);
        }
    };

    const classOptions = classes
        .map(cls => ({
            value: cls.id.toString(),
            label: cls.name,
        }));

    const getClassNames = (classIds: number[]) => {
        return classIds
            .map(id => classes.find(cls => cls.id === id)?.name)
            .filter(Boolean)
            .join(', ');
    };

    if (userRole === null) {
        return (
            <LoaderComponent>
                正在加载用户信息...
            </LoaderComponent>
        )
    }

    if (userRole !== 'teacher') {
        return (
            <Container size="lg" py="xl">
                <Paper p="xl" withBorder>
                    <Text style={{ textAlign: 'center', fontWeight: 'bold' }} size="xl">
                        无访问权限
                    </Text>
                    <Text style={{ textAlign: 'center' }} color="dimmed" mt="md">
                        只有教师可以访问课程管理页面
                    </Text>
                </Paper>
            </Container>
        );
    }

    return (
        <Container size="lg" py="xl">
            <Flex justify="space-between" align="center" mb="xl">
                <div>
                    <Title order={1}>课程管理</Title>
                    <Text color="dimmed" mt="xs">
                        管理您的课程和班级
                    </Text>
                </div>
                <Flex gap="md">
                    <Button
                        leftSection={<IconUsers size={16} />}
                        onClick={() => setClassModalOpened(true)}
                        variant="outline"
                    >
                        添加班级
                    </Button>
                    <Button
                        leftSection={<IconPlus size={16} />}
                        onClick={() => {
                            resetCourseForm();
                            setCourseModalOpened(true);
                        }}
                    >
                        添加课程
                    </Button>
                </Flex>
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
                            <Table.Th>课程名称</Table.Th>
                            <Table.Th>编程语言</Table.Th>
                            <Table.Th>包含班级</Table.Th>
                            <Table.Th>状态</Table.Th>
                            <Table.Th>创建时间</Table.Th>
                            <Table.Th>操作</Table.Th>
                        </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                        {courses.length === 0 ? (
                            <Table.Tr>
                                <Table.Td colSpan={6} style={{ textAlign: 'center', padding: '2rem' }}>
                                    <IconSchool size={48} color="#ccc" />
                                    <Text mt="sm" color="dimmed">
                                        暂无课程，请点击"添加课程"创建您的第一个课程
                                    </Text>
                                </Table.Td>
                            </Table.Tr>
                        ) : (
                            courses.map((course) => (
                                <Table.Tr key={course.id}>
                                    <Table.Td>
                                        <Flex gap="sm" align="center">
                                            <Text fw={500}>{course.name}</Text>
                                        </Flex>
                                    </Table.Td>
                                    <Table.Td>
                                        <Badge variant="light" color="blue">
                                            {course.language.toUpperCase()}
                                        </Badge>
                                    </Table.Td>
                                    <Table.Td>
                                        <Text size="sm">
                                            {course.class_ids && course.class_ids.length > 0
                                                ? getClassNames(course.class_ids)
                                                : '未分配班级'}
                                        </Text>
                                    </Table.Td>
                                    <Table.Td>
                                        <Badge color={course.active ? 'green' : 'red'}>
                                            {course.active ? '活跃' : '禁用'}
                                        </Badge>
                                    </Table.Td>
                                    <Table.Td>
                                        <Text size="sm">
                                            {new Date(course.created_at).toLocaleDateString('zh-CN')}
                                        </Text>
                                    </Table.Td>
                                    <Table.Td>
                                        <Flex gap="xs">
                                            <ActionIcon
                                                onClick={() => openEditCourseModal(course)}
                                            >
                                                <IconEdit size="1rem" stroke={1.5} />
                                            </ActionIcon>
                                            <ActionIcon
                                                color="red"
                                                onClick={() => setDeletingCourse(course)}
                                            >
                                                <IconTrash size="1rem" stroke={1.5} />
                                            </ActionIcon>
                                            <ActionIcon
                                                color="blue"
                                                loading={exportingCourse === course.id}
                                                onClick={() => handleExportCourse(course)}
                                            >
                                                <IconDownload size="1rem" stroke={1.5} />
                                            </ActionIcon>
                                        </Flex>
                                    </Table.Td>
                                </Table.Tr>
                            ))
                        )}
                    </Table.Tbody>
                </Table>
            </Paper>

            {/* 课程编辑/创建模态框 */}
            <Modal
                opened={courseModalOpened}
                onClose={() => {
                    setCourseModalOpened(false);
                    resetCourseForm();
                }}
                title={editingCourse ? '编辑课程' : '创建新课程'}
                size="lg"
            >
                <form onSubmit={courseForm.onSubmit(handleCourseSubmit)}>
                    <Stack gap="md">
                        <TextInput
                            label="课程名称"
                            placeholder="输入课程名称"
                            required
                            {...courseForm.getInputProps('name')}
                        />

                        <Select
                            label="编程语言"
                            placeholder="选择编程语言"
                            data={[...LANGUAGE_OPTIONS, { value: "*", label: "无限制" }]}
                            required
                            {...courseForm.getInputProps('language')}
                        />

                        <MultiSelect
                            label="分配班级"
                            placeholder="选择班级"
                            data={classOptions}
                            searchable
                            clearable
                            value={courseForm.values.class_ids.map(id => id.toString())}
                            onChange={(values) => courseForm.setFieldValue('class_ids', values.map(v => parseInt(v)))}
                        />

                        <Checkbox
                            label="激活课程"
                            {...courseForm.getInputProps('active', { type: 'checkbox' })}
                        />

                        <Flex justify="flex-end" mt="md" gap="md">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setCourseModalOpened(false);
                                    resetCourseForm();
                                }}
                            >
                                取消
                            </Button>
                            <Button type="submit">
                                {editingCourse ? '更新课程' : '创建课程'}
                            </Button>
                        </Flex>
                    </Stack>
                </form>
            </Modal>

            {/* 班级创建模态框 */}
            <Modal
                opened={classModalOpened}
                onClose={() => {
                    setClassModalOpened(false);
                    classForm.reset();
                }}
                title="创建新班级"
            >
                <form onSubmit={classForm.onSubmit(handleClassSubmit)}>
                    <Stack gap="md">
                        <TextInput
                            label="班级名称"
                            placeholder="输入班级名称"
                            required
                            {...classForm.getInputProps('name')}
                        />

                        <Checkbox
                            label="激活班级"
                            {...classForm.getInputProps('active', { type: 'checkbox' })}
                        />

                        <Flex justify="flex-end" mt="md" gap="md">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setClassModalOpened(false);
                                    classForm.reset();
                                }}
                            >
                                取消
                            </Button>
                            <Button type="submit">创建班级</Button>
                        </Flex>
                    </Stack>
                </form>
            </Modal>

            {/* 删除确认模态框 */}
            <Modal
                opened={!!deletingCourse}
                onClose={() => setDeletingCourse(null)}
                title="确认删除"
            >
                <Text>
                    确定要删除课程 "{deletingCourse?.name}" 吗？此操作无法撤销。
                </Text>
                <Text size="sm" color="red" mt="md">
                    注意：删除课程将同时删除与该课程相关的所有作业和学生提交记录。
                </Text>

                <Flex justify="flex-end" mt="xl" gap="md">
                    <Button variant="outline" onClick={() => setDeletingCourse(null)}>
                        取消
                    </Button>
                    <Button color="red" onClick={handleDeleteCourse}>
                        确认删除
                    </Button>
                </Flex>
            </Modal>
        </Container>
    );
};

export default CourseManagementPage;