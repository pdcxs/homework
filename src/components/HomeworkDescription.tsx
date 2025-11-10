// components/HomeworkDescription.tsx
import { Title } from '@mantine/core';
import { useMantineColorScheme } from '@mantine/core';
import MDEditor from '@uiw/react-md-editor';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import 'katex/dist/katex.css';

interface HomeworkDescriptionProps {
    description: string;
}

export function HomeworkDescription({ description }: HomeworkDescriptionProps) {
    const { colorScheme } = useMantineColorScheme();
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
                    remarkPlugins={[remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                />
            </div>
        </>
    );
}