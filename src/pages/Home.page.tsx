// pages/Home.page.tsx
import { 
  Text, 
  Card, 
  Stack, 
  Title, 
  TextInput, 
  Select, 
  Button, 
  Modal, 
  Group, 
  Alert 
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { createClient } from '@supabase/supabase-js';
import LoaderComponent from '@/components/LoaderComponent';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { useDisclosure } from '@mantine/hooks';
import { IconCheck, IconAlertCircle } from '@tabler/icons-react';

const supabase = createClient(import.meta.env.VITE_SUPABASE_URL!, import.meta.env.VITE_SUPABASE_KEY!);

interface UserProfile {
  id: string;
  name: string;
  student_id: string;
  class_id: string;
  class_name: string;
}

interface ClassOption {
  value: string;
  label: string;
}

interface FormValues {
  name: string;
  student_id: string;
  class_id: string;
}

export function HomePage() {
  const queryClient = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const [initialValues, setInitialValues] = useState<FormValues | null>(null);

  const form = useForm<FormValues>({
    initialValues: {
      name: '',
      student_id: '',
      class_id: '',
    },

    validate: {
      name: (value) => 
        value.trim().length === 0 ? '姓名不能为空' : 
        value.trim().length < 2 ? '姓名至少需要2个字符' : null,
      
      student_id: (value) => {
        if (value.trim().length === 0) return '学号不能为空';
        if (!/^\d+$/.test(value)) return '学号必须全部为数字';
        if (value.length < 3) return '学号至少需要3位数字';
        return null;
      },
      
      class_id: (value) => 
        !value ? '请选择班级' : null,
    },
  });

  const isDirty = form.isDirty();

  const { data: profile, isLoading: loading } = useQuery<UserProfile | null>({
    queryKey: ['userProfile'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').single();
      if (error) {
        console.error('Error fetching profile:', error);
        return null;
      }
      const { data: class_data } = await supabase.from('classes').select('name').eq('id', data.class_id).single();
      return {
        id: data.id,
        name: data.name,
        student_id: data.student_id,
        class_id: data.class_id,
        class_name: class_data!.name
      };
    }
  });

  const { data: classOptions } = useQuery<ClassOption[]>({
    queryKey: ['activeClasses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('classes')
        .select('id, name')
        .eq('active', true)
        .order('name');
      
      if (error) {
        console.error('Error fetching classes:', error);
        return [];
      }
      
      return data.map(cls => ({
        value: cls.id.toString(),
        label: cls.name
      }));
    }
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (updatedData: FormValues) => {
      const { error } = await supabase
        .from('profiles')
        .update({
          name: updatedData.name.trim(),
          student_id: updatedData.student_id,
          class_id: updatedData.class_id
        })
        .eq('id', profile!.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
      setUpdateSuccess(true);
      setInitialValues(form.values);
      form.resetDirty();
      close();
      setTimeout(() => setUpdateSuccess(false), 3000);
    },
    onError: (error) => {
      console.error('Error updating profile:', error);
    }
  });

  useEffect(() => {
    if (profile && !initialValues) {
      const formValues = {
        name: profile.name,
        student_id: profile.student_id,
        class_id: profile.class_id.toString()
      };
      
      form.setValues(formValues);
      setInitialValues(formValues);
      form.resetDirty();
    }
  }, [profile, initialValues]);

  const handleConfirm = () => {
    const validation = form.validate();
    if (validation.hasErrors) {
      return;
    }
    open();
  };

  const handleSubmit = () => {
    updateProfileMutation.mutate(form.values);
  };

  if (loading) {
    return <LoaderComponent>加载中...</LoaderComponent>;
  }

  if (!profile) {
    return (
      <Alert icon={<IconAlertCircle size="1rem" />} title="错误" color="red">
        无法加载用户信息，请刷新页面重试。
      </Alert>
    );
  }

  return (
    <Stack gap="lg">
      {updateSuccess && (
        <Alert icon={<IconCheck size="1rem" />} title="成功" color="green">
          个人信息已成功更新！
        </Alert>
      )}

      <Title order={1}>个人信息管理</Title>
      
      <Card shadow="md" p="xl" radius="lg" withBorder>
        <form>
          <Stack gap="xl">
            <div>
              <Text size="xl" fw={600} mb="md">基本信息</Text>
              <Text c="dimmed" size="sm">在这里您可以查看和编辑您的个人信息</Text>
            </div>

            <Stack gap="md">
              <TextInput
                label="姓名"
                placeholder="请输入您的姓名"
                withAsterisk
                size="md"
                {...form.getInputProps('name')}
              />

              <TextInput
                label="学号"
                placeholder="请输入您的学号"
                withAsterisk
                size="md"
                {...form.getInputProps('student_id')}
              />

              <Select
                label="班级"
                placeholder="请选择班级"
                withAsterisk
                size="md"
                data={classOptions || []}
                nothingFoundMessage="未找到符合条件的班级"
                {...form.getInputProps('class_id')}
              />
            </Stack>

            <Group justify="flex-end" mt="md">
              <Button
                size="md"
                disabled={!isDirty}
                onClick={handleConfirm}
                loading={updateProfileMutation.isPending}
              >
                提交更改
              </Button>
            </Group>
          </Stack>
        </form>
      </Card>

      <Modal 
        opened={opened} 
        onClose={close} 
        title="确认更改" 
        size="md"
        centered
      >
        <Stack gap="md">
          <Text>您确定要保存对这些信息的更改吗？</Text>
          <Group justify="flex-end">
            <Button variant="outline" onClick={close} disabled={updateProfileMutation.isPending}>
              取消
            </Button>
            <Button 
              onClick={handleSubmit}
              loading={updateProfileMutation.isPending}
              color="blue"
            >
              确认更改
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}