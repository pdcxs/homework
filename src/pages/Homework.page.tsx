import { useState, useEffect } from 'react';
import { 
  Table, 
  Button, 
  Group, 
  Text, 
  Badge, 
  LoadingOverlay,
  Paper,
  Title,
  Stack
} from '@mantine/core';
import { IconEdit, IconCalendar } from '@tabler/icons-react';
import { useAuth } from '@/App';

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
  const {supabaseClient: supabase} = useAuth();

  useEffect(() => {
    fetchHomeworks();
  }, []);

  const fetchHomeworks = async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. 获取当前用户信息
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('用户未登录');
      }

      // 2. 获取用户的班级ID
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('class_id')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;
      if (!profile) throw new Error('用户信息不存在');

      const userClassId = profile.class_id;

      // 3. 查询包含该班级的课程
      const { data: courses, error: coursesError } = await supabase
        .from('courses')
        .select('id, name, language')
        .contains('class_ids', [userClassId]);

      if (coursesError) throw coursesError;

      if (!courses || courses.length === 0) {
        setHomeworks([]);
        return;
      }

      const courseIds = courses.map(course => course.id);

      // 4. 查询这些课程的作业
      const { data: homeworksData, error: homeworksError } = await supabase
        .from('homeworks')
        .select('*')
        .in('course_id', courseIds);

      if (homeworksError) throw homeworksError;

      if (!homeworksData || homeworksData.length === 0) {
        setHomeworks([]);
        return;
      }

      const homeworkIds = homeworksData.map(hw => hw.id);

      // 5. 查询当前用户对这些作业的答案
      const { data: answers, error: answersError } = await supabase
        .from('answers')
        .select('*')
        .eq('student_id', user.id)
        .in('homework_id', homeworkIds);

      if (answersError) throw answersError;

      // 6. 合并数据
      const processedHomeworks: HomeworkWithStatus[] = homeworksData.map(homework => {
        const course = courses.find(c => c.id === homework.course_id);
        const answer = answers?.find(a => a.homework_id === homework.id);

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
          is_submitted: !!answer
        };
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
    // 这里以后会实现打开提交作业的界面
    console.log('编辑作业:', homework);
    // 例如：openHomeworkEditor(homework);
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
        <Stack gap={4}>
          <Text fw={500}>{homework.title}</Text>
          <Text size="sm" c="dimmed">
            {homework.course_name}
          </Text>
          <Text size="xs" c="dimmed" lineClamp={2}>
            {homework.description}
          </Text>
        </Stack>
      </Table.Td>
      <Table.Td>
        <Badge variant="light">{homework.language.toUpperCase()}</Badge>
      </Table.Td>
      <Table.Td>
        <Group gap="xs">
          <IconCalendar size={16} />
          <Text size="sm">{formatDate(homework.deadline)}</Text>
        </Group>
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
          {homework.is_submitted ? '重新提交' : '提交作业'}
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
          <Table.ScrollContainer minWidth={800}>
            <Table verticalSpacing="md">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>作业信息</Table.Th>
                  <Table.Th>编程语言</Table.Th>
                  <Table.Th>截止时间</Table.Th>
                  <Table.Th>状态</Table.Th>
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