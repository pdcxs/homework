// pages/Home.page.tsx
import { useEffect, useState } from 'react';
import { Text, Card, Stack, Title } from '@mantine/core';
import { createClient } from '@supabase/supabase-js';
import LoaderComponent from '@/components/LoaderComponent';

const supabase = createClient(import.meta.env.VITE_SUPABASE_URL!, import.meta.env.VITE_SUPABASE_KEY!);

interface UserProfile {
  name: string;
  student_id: string;
  class_id: number;
}

export function HomePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('name, student_id, class_id')
          .eq('id', user.id)
          .single();
        
        setProfile(data);
      }
      setLoading(false);
    };

    fetchProfile();
  }, []);

  if (loading) {
    return <LoaderComponent>加载中...</LoaderComponent>;
  }

  return (
    <Stack>
      <Title order={1}>欢迎回来</Title>
      <Card shadow="sm" p="lg" radius="md" withBorder>
        <Text size="lg">
          个人信息
        </Text>
        <Stack mt="md">
          <Text>姓名: {profile?.name}</Text>
          <Text>学号: {profile?.student_id}</Text>
          <Text>班级ID: {profile?.class_id}</Text>
        </Stack>
      </Card>
      {/* 在这里添加你的其他页面内容 */}
    </Stack>
  );
}