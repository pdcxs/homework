import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
    TextInput,
    PasswordInput,
    Button,
    Select,
    Stack,
    Title,
    Modal,
    Text,
    Center,
    Paper,
    Flex
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { ColorSchemeToggle } from "../components/ColorSchemeToggle";
import { useAuth } from "@/App";

interface ClassItem {
    id: number;
    name: string;
}

interface FormValues {
    email: string;
    studentId: string;
    name: string;
    classId: string | null;
    password: string;
    confirmPassword: string;
}

export default function SignUpPage() {
    const [classes, setClasses] = useState<ClassItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [modalOpened, setModalOpened] = useState(false);
    const navigate = useNavigate();
    const { supabaseClient } = useAuth();

    const form = useForm<FormValues>({
        initialValues: {
            email: '',
            studentId: '',
            name: '',
            classId: null,
            password: '',
            confirmPassword: '',
        },

        validate: {
            email: (value) => {
                if (!value) return '邮箱不能为空';
                if (!/^\S+@\S+$/.test(value)) return '邮箱格式不正确';
                return null;
            },
            studentId: (value) => {
                if (!value) return '学号不能为空';
                if (value.length < 3) return '学号长度至少3位';
                if (!value.match(/[0-9]+$/)) return '学号只能包含数字';
                return null;
            },
            name: (value) => {
                if (!value) return '姓名不能为空';
                if (value.length < 2) return '姓名长度至少2位';
                return null;
            },
            classId: (value) => {
                if (!value) return '请选择班级';
                return null;
            },
            password: (value) => {
                if (!value) return '密码不能为空';
                if (value.length < 6) return '密码长度至少6位';
                return null;
            },
            confirmPassword: (value, values) => {
                if (!value) return '请确认密码';
                if (value !== values.password) return '两次输入的密码不一致';
                return null;
            },
        },
    });

    useEffect(() => {
        const fetchClasses = async () => {
            const { data, error } = await supabaseClient
                .from("classes")
                .select("id, name")
                .eq("active", true)
                .order("name");

            if (!error && data) {
                setClasses(data);
            }
        };
        fetchClasses();
    }, []);

    const handleSignUp = async (values: FormValues) => {
        setLoading(true);
        console.log(values);

        const { error } = await supabaseClient.auth.signUp({
            email: values.email,
            password: values.password,
            options: {
                data: {
                    student_id: values.studentId,
                    name: values.name,
                    class_id: values.classId,
                },
            },
        });

        setLoading(false);

        if (error) {
            form.setFieldError('email', error.message);
        } else {
            setModalOpened(true);
        }
    };

    const handleModalClose = () => {
        setModalOpened(false);
        window.location.href = '/homework';
    };

    return (
        <div style={{ paddingTop: "30px" }}>
            <Center w="100%">
                <Paper shadow="xs" withBorder p="sm" m="sm" w="100%" maw="500px">
                    <Stack>
                        <Flex justify="space-between" w="100%">
                            <div style={{ width: "24px" }}></div>
                            <Title order={2} ta="center">注册新账号</Title>
                            <ColorSchemeToggle />
                        </Flex>

                        <form onSubmit={form.onSubmit(handleSignUp)}>
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

                                <PasswordInput
                                    label="确认密码"
                                    placeholder="请再次输入密码"
                                    required
                                    {...form.getInputProps('confirmPassword')}
                                />

                                <TextInput
                                    label="姓名"
                                    placeholder="请输入姓名"
                                    required
                                    {...form.getInputProps('name')}
                                />

                                <TextInput
                                    label="学号"
                                    placeholder="请输入学号"
                                    required
                                    {...form.getInputProps('studentId')}
                                />

                                <Select
                                    label="班级"
                                    placeholder="请选择班级"
                                    data={classes.map((c) => ({ value: c.id.toString(), label: c.name }))}
                                    required
                                    {...form.getInputProps('classId')}
                                />

                                <Button
                                    type="submit"
                                    fullWidth
                                    loading={loading}
                                    mt="md"
                                >
                                    注册
                                </Button>

                                <Flex justify="space-between" mt="md">
                                    <Text>已有账号？</Text>
                                    <Button variant="subtle" component={Link} to="/">返回登录</Button>
                                </Flex>
                            </Stack>
                        </form>
                    </Stack>
                </Paper>
            </Center>

            <Modal
                opened={modalOpened}
                onClose={handleModalClose}
                title="注册成功"
                centered
            >
                <Text>激活邮件已发送，请前往邮箱激活账号后登录。</Text>
                <Button mt="md" fullWidth onClick={handleModalClose}>确定</Button>
            </Modal>
        </div>
    );
}