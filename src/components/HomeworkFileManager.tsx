// components/HomeworkFileManager.tsx
import { useState, useEffect } from 'react';
import {
    Paper,
    Title,
    Button,
    Stack,
    Group,
    TextInput,
    Checkbox,
    ActionIcon,
    Table,
    Text,
    Modal,
    Textarea,
} from '@mantine/core';
import { IconPlus, IconEdit, IconTrash, IconFileCode } from '@tabler/icons-react';
import { useAuth } from '@/App';
import { HomeworkFile } from '@/lib/database';

interface HomeworkFileManagerProps {
    homeworkId: string;
}

export function HomeworkFileManager({ homeworkId }: HomeworkFileManagerProps) {
    const { supabaseClient: supabase } = useAuth();
    const [files, setFiles] = useState<HomeworkFile[]>([]);
    const [editingFile, setEditingFile] = useState<HomeworkFile | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newFile, setNewFile] = useState<Omit<HomeworkFile, 'homework_id'>>({
        file_name: '',
        file_content: '',
        editable: true,
        is_custom: false,
        custom_id: '',
    });

    useEffect(() => {
        fetchFiles();
    }, [homeworkId]);

    const fetchFiles = async () => {
        try {
            const { data, error } = await supabase
                .from('homework_files')
                .select('*')
                .eq('homework_id', homeworkId)
                .order('id');

            if (error) throw error;
            setFiles(data || []);
        } catch (err: any) {
            console.error('获取文件失败:', err);
        }
    };

    const handleAddFile = async () => {
        try {
            const { error } = await supabase
                .from('homework_files')
                .insert([{
                    homework_id: parseInt(homeworkId),
                    file_name: newFile.file_name,
                    file_content: newFile.file_content,
                    editable: newFile.editable,
                }]);

            if (error) throw error;

            setShowAddModal(false);
            setNewFile({
                file_name: '',
                file_content: '',
                editable: true,
                custom_id: '',
                is_custom: false,
            });
            fetchFiles();
        } catch (err: any) {
            console.error('添加文件失败:', err);
        }
    };

    const handleUpdateFile = async () => {
        if (!editingFile || !editingFile.id) return;

        try {
            const { error } = await supabase
                .from('homework_files')
                .update({
                    file_name: editingFile.file_name,
                    file_content: editingFile.file_content,
                    editable: editingFile.editable,
                })
                .eq('id', editingFile.id);

            if (error) throw error;

            setEditingFile(null);
            fetchFiles();
        } catch (err: any) {
            console.error('更新文件失败:', err);
        }
    };

    const handleDeleteFile = async (fileId: bigint) => {
        try {
            const { error } = await supabase
                .from('homework_files')
                .delete()
                .eq('id', fileId);

            if (error) throw error;
            fetchFiles();
        } catch (err: any) {
            console.error('删除文件失败:', err);
        }
    };

    const rows = files.map((file) => (
        <Table.Tr key={file.id}>
            <Table.Td>
                <Group gap="sm">
                    <IconFileCode size={16} />
                    <Text>{file.file_name}</Text>
                </Group>
            </Table.Td>
            <Table.Td>
                <Checkbox
                    checked={!file.editable}
                    readOnly
                    label='只读'
                />
            </Table.Td>
            <Table.Td>
                <Group gap="xs">
                    <ActionIcon
                        variant="subtle"
                        onClick={() => setEditingFile(file)}
                    >
                        <IconEdit size={16} />
                    </ActionIcon>
                    <ActionIcon
                        color="red"
                        variant="subtle"
                        onClick={() => file.id && handleDeleteFile(file.id)}
                    >
                        <IconTrash size={16} />
                    </ActionIcon>
                </Group>
            </Table.Td>
        </Table.Tr>
    ));

    return (
        <Stack p="xl">
            <Group justify="space-between">
                <Title order={3}>作业文件管理</Title>
                <Button
                    leftSection={<IconPlus size={16} />}
                    onClick={() => setShowAddModal(true)}
                >
                    添加文件
                </Button>
            </Group>

            {files.length === 0 ? (
                <Paper p="xl" withBorder>
                    <Text color="dimmed" ta="center">
                        暂无文件，点击"添加文件"来创建
                    </Text>
                </Paper>
            ) : (
                <Table>
                    <Table.Thead>
                        <Table.Tr>
                            <Table.Th>文件名</Table.Th>
                            <Table.Th>编辑权限</Table.Th>
                            <Table.Th>操作</Table.Th>
                        </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>{rows}</Table.Tbody>
                </Table>
            )}

            {/* 添加文件模态框 */}
            <Modal
                opened={showAddModal}
                onClose={() => setShowAddModal(false)}
                title="添加新文件"
                size="lg"
            >
                <Stack>
                    <TextInput
                        label="文件名"
                        placeholder="例如: main.cpp"
                        value={newFile.file_name}
                        onChange={(e) => setNewFile({ ...newFile, file_name: e.target.value })}
                    />
                    <Textarea
                        label="文件内容"
                        placeholder="输入文件内容..."
                        minRows={8}
                        value={newFile.file_content}
                        onChange={(e) => setNewFile({ ...newFile, file_content: e.target.value })}
                    />
                    <Checkbox
                        label="学生可编辑"
                        checked={newFile.editable}
                        onChange={(e) => setNewFile({ ...newFile, editable: e.currentTarget.checked })}
                    />
                    <Group justify="flex-end">
                        <Button variant="outline" onClick={() => setShowAddModal(false)}>
                            取消
                        </Button>
                        <Button onClick={handleAddFile}>
                            添加文件
                        </Button>
                    </Group>
                </Stack>
            </Modal>

            {/* 编辑文件模态框 */}
            <Modal
                opened={!!editingFile}
                onClose={() => setEditingFile(null)}
                title="编辑文件"
                size="lg"
            >
                {editingFile && (
                    <Stack>
                        <TextInput
                            label="文件名"
                            value={editingFile.file_name}
                            onChange={(e) => setEditingFile({ ...editingFile, file_name: e.target.value })}
                        />
                        <Textarea
                            label="文件内容"
                            minRows={8}
                            value={editingFile.file_content}
                            onChange={(e) => setEditingFile({ ...editingFile, file_content: e.target.value })}
                        />
                        <Checkbox
                            label="学生可编辑"
                            checked={editingFile.editable}
                            onChange={(e) => setEditingFile({ ...editingFile, editable: e.currentTarget.checked })}
                        />
                        <Group justify="flex-end">
                            <Button variant="outline" onClick={() => setEditingFile(null)}>
                                取消
                            </Button>
                            <Button onClick={handleUpdateFile}>
                                保存更改
                            </Button>
                        </Group>
                    </Stack>
                )}
            </Modal>
        </Stack>
    );
}