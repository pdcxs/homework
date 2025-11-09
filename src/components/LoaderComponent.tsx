// components/LoaderComponent.tsx
import { Center, Loader, Stack, Text } from "@mantine/core";

export default function LoaderComponent({ children }: { children: React.ReactNode }) {
    return (
        <Center pt="100px">
            <Stack align="center">
                <Loader size="xl" />
                <Text size="xl">{children}</Text>
            </Stack>
        </Center>
    );
}