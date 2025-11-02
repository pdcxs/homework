// components/DashboardLayout.tsx
import { useEffect, useState } from 'react';
import {
    AppShell,
    Tooltip,
    Button,
    NavLink,
    Flex,
    Divider,
    Group,
    Burger,
} from '@mantine/core';
import {
    IconEdit,
    IconHome,
    IconLogout,
    IconLogout2
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
    const [mobileOpened, { toggle: toggleMobile }] = useDisclosure();
    const [desktopOpened, { toggle: toggleDesktop }] = useDisclosure(true);

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

    const navItems = [
        { icon: IconHome, label: '首页', path: '/' },
        { icon: IconEdit, label: '作业', path: '/homework' },
    ];

    return (
        <AppShell
            navbar={{ width: 200, breakpoint: 'sm', collapsed: { mobile: !mobileOpened, desktop: !desktopOpened }, }}
            header={{ height: 45 }}>
            <AppShell.Header>
                <Flex justify="space-between" gap="md" mr="20px" pt="5px">
                    <Group h="100%" px="md">
                        <Burger opened={mobileOpened} onClick={toggleMobile} hiddenFrom="sm" size="sm" />
                        <Burger opened={desktopOpened} onClick={toggleDesktop} visibleFrom="sm" size="sm" />
                    </Group>
                    <Group>
                        <ColorSchemeToggle />
                        <Tooltip label="退出登录" position="bottom">
                            <Button p="5" variant="default" c="red" onClick={signOut} >
                                <IconLogout2 size="24" stroke={1.5} />
                            </Button>
                        </Tooltip>
                    </Group>
                </Flex>
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
                <Divider my="md" />
                <NavLink
                    leftSection={<IconLogout size="1rem" stroke={1.5} />}
                    label="退出登录"
                    c="red"
                    onClick={signOut}
                />
            </AppShell.Navbar>
            <AppShell.Main m="md">
                {children}
            </AppShell.Main>
        </AppShell>
    );
}