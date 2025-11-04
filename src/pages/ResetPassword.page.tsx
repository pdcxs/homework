// ResetPasswordPage.tsx
import { useEffect, useState } from 'react';
import { PasswordInput, Button, Stack, Title, Alert, Text } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconAlertCircle } from '@tabler/icons-react';
import { ColorSchemeToggle } from '@/components/ColorSchemeToggle';
import { useAuth } from '@/App';

export default function ResetPasswordPage() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);
    const { supabaseClient: supabase } = useAuth();

    useEffect(() => {
        if (success) {
            const timer = setTimeout(async () => {
                await supabase.auth.signOut();
                window.location.href = '/homework';
            }, 3000);

            return () => clearTimeout(timer);
        }
    }, [success]);

    const form = useForm({
        initialValues: {
            password: '',
            confirmPassword: '',
        },
        validate: {
            password: (value) => (value.length < 6 ? '密码至少需要6位' : null),
            confirmPassword: (value, values) =>
                value !== values.password ? '两次输入的密码不一致' : null,
        },
    });

    const handleResetPassword = async (values: { password: string; }) => {
        setLoading(true);
        setError("");

        const { error: updateError } = await supabase.auth.updateUser({
            password: values.password,
        });

        setLoading(false);

        if (updateError) {
            setError(updateError.message);
        } else {
            setSuccess(true);
        }
    };

    if (success) {
        return (
            <Stack align="center" justify="center" style={{ height: '100vh' }}>
                <Title order={2}>密码重置成功</Title>
                <Text>您的密码已成功更新。您将被重定向到登录页面。</Text>
            </Stack>
        );
    }

    return (
        <Stack align="center" justify="center" style={{ height: '100vh' }}>
            <div style={{ position: "absolute", top: 16, right: 16 }}>
                <ColorSchemeToggle />
            </div>
            <Title order={2}>设置新密码</Title>
            <form onSubmit={form.onSubmit(handleResetPassword)} style={{ width: '100%', maxWidth: 400 }}>
                <Stack>
                    {error && (
                        <Alert icon={<IconAlertCircle size="1rem" />} title="错误" color="red">
                            {error}
                        </Alert>
                    )}
                    <PasswordInput
                        label="新密码"
                        placeholder="请输入您的新密码"
                        required
                        {...form.getInputProps('password')}
                    />
                    <PasswordInput
                        label="确认新密码"
                        placeholder="请再次输入您的新密码"
                        required
                        {...form.getInputProps('confirmPassword')}
                    />
                    <Button type="submit" loading={loading} fullWidth>
                        重置密码
                    </Button>
                </Stack>
            </form>
        </Stack>
    );
}