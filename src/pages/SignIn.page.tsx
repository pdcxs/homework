import { useNavigate, Link } from "react-router-dom";
import {
  TextInput,
  PasswordInput,
  Button,
  Anchor,
  Group,
  Stack,
  Title,
  Modal,
  Text,
  Flex,
  Paper,
  Center
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { createClient } from "@supabase/supabase-js";
import { ColorSchemeToggle } from "../components/ColorSchemeToggle";
import { useState } from "react";

const supabase = createClient(import.meta.env.VITE_SUPABASE_URL!, import.meta.env.VITE_SUPABASE_KEY!);

interface FormValues {
  email: string;
  password: string;
}

export default function SignInPage() {
  const [loading, setLoading] = useState(false);
  const [modalOpened, setModalOpened] = useState(false);
  const [modalText, setModalText] = useState("");
  const navigate = useNavigate();

  const form = useForm<FormValues>({
    initialValues: {
      email: '',
      password: '',
    },

    validate: {
      email: (value) => {
        if (!value) return '邮箱不能为空';
        if (!/^\S+@\S+$/.test(value)) return '邮箱格式不正确';
        return null;
      },
      password: (value) => {
        if (!value) return '密码不能为空';
        return null;
      },
    },
  });

  const handleSignIn = async (values: FormValues) => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password
    });
    setLoading(false);

    if (error) {
      setModalText(error.message);
      setModalOpened(true);
    } else {
      navigate("/");
    }
  };

  const handleResetPassword = async () => {
    // 验证邮箱格式
    if (!form.values.email) {
      form.setFieldError('email', '请输入邮箱地址以重置密码');
      return;
    }

    if (!/^\S+@\S+$/.test(form.values.email)) {
      form.setFieldError('email', '请输入有效的邮箱地址');
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(
      form.values.email, {
      redirectTo: window.location.origin + '/reset-password'
    });
    if (error) {
      setModalText(error.message);
    } else {
      setModalText("重置密码邮件已发送，请查收邮箱。");
    }
    setModalOpened(true);
  };

  return (
    <div style={{ position: "relative", minHeight: "100vh" }}>
      <div style={{ position: "absolute", top: 16, right: 16 }}>
        <ColorSchemeToggle />
      </div>

      <Center w="100%">
        <Paper shadow="xs" mt="100px" withBorder p="xl" m="md" w="100%" maw="500px">
          <Stack m="30px" align="center" justify="center">
            <Title order={2}>登录</Title>

            <form onSubmit={form.onSubmit(handleSignIn)} style={{ width: "100%" }}>
              <Stack>
                <TextInput
                  label="邮箱"
                  placeholder="请输入邮箱"
                  required
                  {...form.getInputProps('email')}
                />

                <PasswordInput
                  label="密码"
                  placeholder="请输入密码"
                  required
                  {...form.getInputProps('password')}
                />

                <Button
                  type="submit"
                  fullWidth
                  loading={loading}
                >
                  登录
                </Button>

                <Flex mt="md" justify="space-between" align="center">
                  <Anchor component={Link} to="/sign-up" size="sm">
                    没有账号？注册新账号
                  </Anchor>
                  <Anchor
                    onClick={handleResetPassword}
                    size="sm"
                  >
                    忘记密码？
                  </Anchor>
                </Flex>
              </Stack>
            </form>
          </Stack>
        </Paper>
      </Center>

      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title="提示"
        centered
      >
        <Text>{modalText}</Text>
        <Button fullWidth mt="md" onClick={() => setModalOpened(false)}>
          确定
        </Button>
      </Modal>
    </div>
  );
}