import { useNavigate, Link } from "react-router-dom";
import {
  TextInput,
  PasswordInput,
  Button,
  Anchor,
  Stack,
  Title,
  Modal,
  Text,
  Flex,
  Paper,
  Center
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { ColorSchemeToggle } from "../components/ColorSchemeToggle";
import { useState } from "react";
import { useAuth } from "../App";

interface FormValues {
  email: string;
  password: string;
}

export default function SignInPage() {
  const [loading, setLoading] = useState(false);
  const [modalOpened, setModalOpened] = useState(false);
  const [modalText, setModalText] = useState("");
  const navigate = useNavigate();
  const { supabaseClient, setSession } = useAuth();

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

    // 使用全局 Supabase 客户端进行登录
    const { error } = await supabaseClient.auth.signInWithPassword({
      email: values.email,
      password: values.password
    });

    setLoading(false);
    setSession((await supabaseClient.auth.getSession()).data.session);

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

    // 使用全局 Supabase 客户端
    const { error } = await supabaseClient.auth.resetPasswordForEmail(
      form.values.email, {
      redirectTo: window.location.origin + '/homework/reset-password'
    });

    if (error) {
      setModalText(error.message);
    } else {
      setModalText("重置密码邮件已发送，请查收邮箱。");
    }
    setModalOpened(true);
  };

  return (
    <div style={{ position: "relative", paddingTop: "20vh" }}>
      <Center w="100%">
        <Paper shadow="xs" withBorder p="sm" m="sm" w="100%" maw="500px">
          <Stack align="center" justify="center">
            <Flex justify="space-between" w="100%">
              <div style={{ width: "24px" }}></div>
              <Title order={2}>登录</Title>
              <ColorSchemeToggle />
            </Flex>
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