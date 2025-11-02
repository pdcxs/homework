// components/DashboardLayout.tsx
import { useEffect, useState } from 'react';
import {
    AppShell,
    Group,
    Button,
    Text,
    NavLink,
} from '@mantine/core';
import {
    IconHome,
    IconLogout,
} from '@tabler/icons-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ColorSchemeToggle } from './ColorSchemeToggle';
import { useDisclosure } from '@mantine/hooks';
import { useAuth } from '@/App';

interface DashboardLayoutProps {
    children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
    const { supabaseClient, signOut } = useAuth();
    const [active, setActive] = useState(0);
    const navigate = useNavigate();
    const location = useLocation();
    const [opened, { toggle }] = useDisclosure();

    useEffect(() => {
        const {
            data: { subscription },
        } = supabaseClient.auth.onAuthStateChange(async (event, session) => {
            if (event === 'PASSWORD_RECOVERY') {
                navigate('/reset-password', { replace: true });
            }
        });

        return () => subscription.unsubscribe();
    }, [navigate]);

    const handleLogout = async () => {
        await signOut();
        window.location.href = '/homework';
    };

    const navItems = [
        { icon: IconHome, label: '首页', path: '/' },
    ];

    return (
        <AppShell
            padding="md"
            navbar={{ width: 200, breakpoint: 'sm', collapsed: { mobile: !opened } }}
            header={{ height: 60 }}>
            <AppShell.Header>
                <Group>
                    <Text size="xl" style={{ fontWeight: 'bold' }}>
                        你的应用名称
                    </Text>
                    <Group>
                        <ColorSchemeToggle />
                        <Button variant="light" onClick={handleLogout}>
                            退出登录
                        </Button>
                    </Group>
                </Group>
            </AppShell.Header>

            <AppShell.Navbar>
                {navItems.map((item, index) => (
                    <NavLink
                        key={item.label}
                        active={location.pathname === item.path}
                        label={item.label}
                        leftSection={<item.icon size="1rem" stroke={1.5} />}
                        onClick={() => {
                            setActive(index);
                            navigate(item.path);
                        }}
                    />
                ))}
                <NavLink
                    leftSection={<IconLogout size="1rem" stroke={1.5} />}
                    label="退出登录"
                    onClick={handleLogout}
                />
            </AppShell.Navbar>
            <AppShell.Main>
                {children}
            </AppShell.Main>
        </AppShell>
    );
}