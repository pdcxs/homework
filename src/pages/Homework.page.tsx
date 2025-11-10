// pages/Homework.page.tsx
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
  Select
} from '@mantine/core';
import { useAuth } from '@/App';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { useNavigate } from 'react-router-dom';

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
  published: boolean;
}

export default function HomeworkPage() {
  const [homeworks, setHomeworks] = useState<HomeworkWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { supabaseClient: supabase } = useAuth();
  const navigate = useNavigate();
  const [selectedCourses, setSelectedCourses] = useState<string[]>(["所有课程"])
  const [filteredHomeworks, setFilteredHomeworks] = useState<HomeworkWithStatus[]>([]);
  const [filteredCourse, setFilteredCourse] = useState<string>("所有课程")

  useEffect(() => {
    fetchHomeworks();

    // 设置实时订阅
    const subscription = supabase
      .channel('homeworks-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'homeworks'
        },
        (_payload: RealtimePostgresChangesPayload<any>) => {
          fetchHomeworks();
        }
      )
      .subscribe();

    // 清理函数：组件卸载时取消订阅
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    setSelectedCourses(
      ["所有课程", ...new Set(homeworks.map((h) => h.course_name))]
    )
  }, [homeworks])

  useEffect(() => {
    if (filteredCourse === "所有课程") {
      setFilteredHomeworks(homeworks);
      return;
    }
    setFilteredHomeworks(homeworks.filter(h => h.course_name === filteredCourse))
  }, [homeworks, filteredCourse])

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
            published: homework.published,
          };
        })
        .filter((h) => h.published)
        .sort((h1, h2) => {
          const now = new Date().getTime();
          const h1Deadline = new Date(h1.deadline).getTime();
          const h2Deadline = new Date(h2.deadline).getTime();

          // 检查是否超时
          const h1Expired = h1Deadline < now;
          const h2Expired = h2Deadline < now;

          // 如果两个作业都超时，按截止时间升序排列
          if (h1Expired && h2Expired) {
            return h1Deadline - h2Deadline;
          }

          // 如果只有h1超时，h1排在后面
          if (h1Expired && !h2Expired) {
            return 1;
          }

          // 如果只有h2超时，h2排在后面
          if (!h1Expired && h2Expired) {
            return -1;
          }

          // 两个作业都未超时，检查提交状态
          if (h1.is_submitted !== h2.is_submitted) {
            // 已提交的作业排在未提交的后面
            return h1.is_submitted ? 1 : -1;
          }

          // 两个作业提交状态相同，按截止时间升序排列
          return h1Deadline - h2Deadline;
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
    const params = homework.answer_id ?
      `?answer_id=${homework.answer_id}` : '';
    navigate(`/edit/${homework.id}${params}`);
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
        <Text c="red">错误: {error}</Text>
        <Button onClick={fetchHomeworks} mt="md">
          重试
        </Button>
      </Paper>
    );
  }

  const rows = filteredHomeworks.map((homework) => (
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

        <Select value={filteredCourse}
          onChange={(v) => setFilteredCourse(v!)}
          defaultValue={"所有课程"}
          data={selectedCourses} />

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