import { useEffect, useState } from 'react';
import { IconEdit } from '@tabler/icons-react';
import {
  Badge,
  Button,
  Group,
  LoadingOverlay,
  Paper,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { useAuth } from '@/App';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

interface HomeworkWithStatus {
  id: bigint;
  course_id: bigint;
  title: string;
  description: string;
  deadline: string;
  created_at: string;
  course_name: string;
  language: string;
  submitted_at: string | null;
  answer_id: bigint | null;
  is_submitted: boolean;
}

export default function HomeworkPage() {
  const [homeworks, setHomeworks] = useState<HomeworkWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { supabaseClient: supabase } = useAuth();

  useEffect(() => {
    fetchHomeworks();
    
    // 设置实时订阅
    const subscription = supabase
      .channel('homeworks-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // 监听所有事件：INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'homeworks'
        },
        (payload: RealtimePostgresChangesPayload<any>) => {
          console.log('作业数据发生变化:', payload);
          // 当homeworks表有变化时重新获取数据
          fetchHomeworks();
        }
      )
      .subscribe();

    // 清理函数：组件卸载时取消订阅
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchHomeworks = async () => {
    try {
      setError(null);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('用户未登录');
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('class_id')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;
      if (!profile) throw new Error('用户信息不存在');

      const userClassId = profile.class_id;

      const { data: courses, error: coursesError } = await supabase
        .from('courses')
        .select('id, name, language')
        .contains('class_ids', [userClassId]);

      if (coursesError) throw coursesError;

      if (!courses || courses.length === 0) {
        setHomeworks([]);
        return;
      }

      const courseIds = courses.map((course) => course.id);

      const { data: homeworksData, error: homeworksError } = await supabase
        .from('homeworks')
        .select('*')
        .in('course_id', courseIds);

      if (homeworksError) throw homeworksError;

      if (!homeworksData || homeworksData.length === 0) {
        setHomeworks([]);
        return;
      }

      const homeworkIds = homeworksData.map((hw) => hw.id);

      const { data: answers, error: answersError } = await supabase
        .from('answers')
        .select('*')
        .eq('student_id', user.id)
        .in('homework_id', homeworkIds);

      if (answersError) throw answersError;

      const processedHomeworks: HomeworkWithStatus[] = homeworksData
        .map((homework) => {
          const course = courses.find((c) => c.id === homework.course_id);
          const answer = answers?.find((a) => a.homework_id === homework.id);

          return {
            id: homework.id,
            course_id: homework.course_id,
            title: homework.title,
            description: homework.description,
            deadline: homework.deadline,
            created_at: homework.created_at,
            course_name: course?.name || '未知课程',
            language: course?.language || 'cpp',
            submitted_at: answer?.submitted_at || null,
            answer_id: answer?.id || null,
            is_submitted: !!answer,
          };
        })
        .sort((h1, h2) => {
          return new Date(h1.deadline).getTime() - new Date(h2.deadline).getTime();
        });

      setHomeworks(processedHomeworks);
    } catch (err) {
      console.error('获取作业列表失败:', err);
      setError(err instanceof Error ? err.message : '获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN');
  };

  const getStatusBadge = (homework: HomeworkWithStatus) => {
    const now = new Date();
    const deadline = new Date(homework.deadline);

    if (homework.is_submitted) {
      return <Badge color="green">已提交</Badge>;
    } else if (now > deadline) {
      return <Badge color="red">已过期</Badge>;
    } else {
      return <Badge color="yellow">未提交</Badge>;
    }
  };

  const handleEdit = (homework: HomeworkWithStatus) => {
    // TODO: finish this.
    console.log('编辑作业:', homework);
  };

  if (loading) {
    return (
      <Paper p="xl" style={{ position: 'relative', minHeight: 200 }}>
        <LoadingOverlay visible={loading} />
      </Paper>
    );
  }

  if (error) {
    return (
      <Paper p="xl">
        <Text color="red">错误: {error}</Text>
        <Button onClick={fetchHomeworks} mt="md">
          重试
        </Button>
      </Paper>
    );
  }

  const rows = homeworks.map((homework) => (
    <Table.Tr key={homework.id.toString()}>
      <Table.Td>
        <Text>{homework.title}</Text>
      </Table.Td>
      <Table.Td>
        <Text size="sm">{formatDate(homework.deadline)}</Text>
      </Table.Td>
      <Table.Td>
        {homework.is_submitted ? (
          <Group gap="xs">
            <Badge color="green">已提交</Badge>
            <Text size="sm" c="dimmed">
              {formatDate(homework.submitted_at!)}
            </Text>
          </Group>
        ) : (
          getStatusBadge(homework)
        )}
      </Table.Td>
      <Table.Td>
        <Button
          leftSection={<IconEdit size={16} />}
          variant="light"
          onClick={() => handleEdit(homework)}
          disabled={new Date() > new Date(homework.deadline) && !homework.is_submitted}
        >
          {homework.is_submitted ? '重写' : '提交'}
        </Button>
      </Table.Td>
    </Table.Tr>
  ));

  return (
    <Paper p="xl" radius="md" withBorder>
      <Stack>
        <Title order={2}>我的作业</Title>

        {homeworks.length === 0 ? (
          <Text c="dimmed" ta="center" py="xl">
            暂无作业
          </Text>
        ) : (
          <Table.ScrollContainer minWidth={300}>
            <Table verticalSpacing="md">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th miw={100}>作业信息</Table.Th>
                  <Table.Th>截止时间</Table.Th>
                  <Table.Th miw={80}>状态</Table.Th>
                  <Table.Th>操作</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>{rows}</Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Stack>
    </Paper>
  );
}