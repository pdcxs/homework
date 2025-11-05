import { Grid, TextInput, Textarea } from '@mantine/core';

interface CompileOptionsPanelProps {
    compileOptions: string;
    onCompileOptionsChange: (value: string) => void;
    stdin: string;
    onStdinChange: (value: string) => void;
    hasPresetCompileOptions: boolean;
    hasTestCases: boolean;
}

export function CompileOptionsPanel({
    compileOptions,
    onCompileOptionsChange,
    stdin,
    onStdinChange,
    hasPresetCompileOptions,
    hasTestCases
}: CompileOptionsPanelProps) {
    return (
        <Grid>
            <Grid.Col span={{ base: 12, md: 6 }}>
                <Textarea
                    label="编译选项"
                    value={compileOptions}
                    onChange={(event) => onCompileOptionsChange(event.currentTarget.value)}
                    disabled={hasPresetCompileOptions}
                    placeholder={hasPresetCompileOptions ? '使用预设编译选项' : '输入编译选项...'}
                    description={hasPresetCompileOptions ? '使用教师预设的编译选项' : '可自定义编译选项'}
                />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 6 }}>
                <Textarea
                    label="标准输入 (stdin)"
                    value={stdin}
                    onChange={(event) => onStdinChange(event.currentTarget.value)}
                    placeholder="输入程序的标准输入..."
                    autosize
                    minRows={2}
                    disabled={hasTestCases}
                    description={hasTestCases ? '使用教师预设的测试用例' : '手动输入标准输入'}
                />
            </Grid.Col>
        </Grid>
    );
}