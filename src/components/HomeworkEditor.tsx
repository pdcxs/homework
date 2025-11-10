// components/HomeworkEditor.tsx
import {
    Paper,
    Title,
    Stack,
    TextInput,
    Select,
    Textarea,
    Group,
    Button,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { UseFormReturnType } from '@mantine/form';
import { HomeworkFormValues } from '@/pages/HomeworkEdit.page';

interface Course {
    id: number;
    name: string;
    language: string;
}

interface HomeworkEditorProps {
    form: UseFormReturnType<HomeworkFormValues>;
    courses: Course[];
    onSave: (publish: boolean) => void;
    onCancel: () => void;
    saving?: boolean;
}

export function HomeworkEditor({
    form,
    courses,
    onSave,
    onCancel,
    saving = false,
}: HomeworkEditorProps) {
    const courseOptions = courses.map(course => ({
        value: course.id.toString(),
        label: course.name,
    }));

    return (
        <Paper withBorder p="xl">
            <Stack>
                <Title order={3}>作业信息</Title>

                <Group grow>
                    <TextInput
                        label="作业标题"
                        placeholder="输入作业标题"
                        required
                        {...form.getInputProps('title')}
                    />
                    <Select
                        label="所属课程"
                        placeholder="选择课程"
                        data={courseOptions}
                        required
                        {...form.getInputProps('course_id')}
                    />
                </Group>

                <DateInput
                    label="截止时间"
                    placeholder="选择截止时间"
                    required
                    valueFormat="YYYY-MM-DD HH:mm"
                    {...form.getInputProps('deadline')}
                />

                <Textarea
                    label="作业描述 (Markdown)"
                    placeholder="输入作业描述..."
                    required
                    autosize
                    {...form.getInputProps('description')}
                />

                <Group justify="flex-end" mt="md">
                    <Button
                        variant="outline"
                        onClick={onCancel}
                    >
                        取消
                    </Button>
                    <Button
                        variant="light"
                        onClick={() => onSave(false)}
                        loading={saving}
                    >
                        保存草稿
                    </Button>
                    <Button
                        onClick={() => onSave(true)}
                        loading={saving}
                    >
                        发布作业
                    </Button>
                </Group>
            </Stack>
        </Paper>
    );
}