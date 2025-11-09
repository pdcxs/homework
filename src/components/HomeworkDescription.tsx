// components/HomeworkDescription.tsx
import { MantineColorScheme, Title } from '@mantine/core';
import MDEditor from '@uiw/react-md-editor';

interface HomeworkDescriptionProps {
    description: string;
    colorScheme: MantineColorScheme;
}

export function HomeworkDescription({ description, colorScheme }: HomeworkDescriptionProps) {
    return (
        <>
            <Title order={4} mb="md">作业描述</Title>
            <div data-color-mode={colorScheme}>
                <MDEditor.Markdown
                    source={description}
                    style={{
                        whiteSpace: 'pre-wrap',
                        backgroundColor: 'transparent'
                    }}
                />
            </div>
        </>
    );
}