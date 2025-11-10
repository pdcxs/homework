export interface CompilerInfo {
    name: string;
    version: string;
    language: string;
}

export interface RunResult {
    success: boolean;
    output: string;
    error?: string;
    signal?: string;
    status?: string;
    testResults?: TestCaseResult[];
    allTestsPassed?: boolean;
}

export interface TestCaseResult {
    input: string;
    expectedOutput: string;
    actualOutput: string;
    passed: boolean;
}

export interface WandboxRequest {
    compiler: string;
    code: string;
    codes: Array<{ file: string; code: string }>;
    options: string;
    stdin: string;
    compiler_option_raw: string;
    runtime_option_raw: string;
}

export const LANGUAGE_OPTIONS = [
    { value: 'cpp', label: 'C++' },
    { value: 'java', label: 'Java' },
    { value: 'python', label: 'Python' },
    { value: 'csharp', label: 'C#' },
    { value: 'go', label: 'Go' },
    { value: 'haskell', label: 'Haskell' },
    { value: 'lisp', label: 'Lisp' },
];

export const FILE_EXTENSIONS: Record<string, string> = {
    'cpp': '.cpp',
    'c++': '.cpp',
    'java': '.java',
    'python': '.py',
    'csharp': '.cs',
    'go': '.go',
    'haskell': '.hs',
    'lisp': '.lisp',
};

export const getLatestCompiler = async (language: string): Promise<string> => {
    const response = await fetch('https://wandbox.org/api/list.json');

    if (!response.ok) {
        throw new Error(`Failed to fetch compilers: ${response.status} ${response.statusText}`);
    }

    const data: CompilerInfo[] = await response.json(); // 只调用一次

    const lang = language.toLowerCase() === "cpp" ? "c++" : language;
    const latestCompiler = data.find(c => c.language.toLowerCase() === lang.toLowerCase());

    if (!latestCompiler) {
        throw new Error(`No compiler found for language: ${language}`);
    }
    if (latestCompiler.name === "cpython-head") {
        return "cpython-3.14.0";
    }

    return latestCompiler.name;
};

const executeWandbox = async (
    compiler: string,
    fileContents: Record<string, string>,
    stdin: string,
    compileOptions: string
): Promise<RunResult> => {
    const wandboxData: WandboxRequest = {
        compiler,
        code: '',
        codes: Object.entries(fileContents).map(([fileName, content]) => ({
            file: fileName,
            code: content
        })),
        options: compileOptions || "",
        stdin,
        compiler_option_raw: compileOptions || "",
        runtime_option_raw: ""
    };

    // 查找主文件
    const mainFile = Object.keys(fileContents).find(file =>
        file.startsWith('Main.') || file.startsWith('main.')
    );
    if (mainFile) {
        wandboxData.code = fileContents[mainFile];
    } else if (Object.keys(fileContents).length > 0) {
        const firstFileName = Object.keys(fileContents)[0];
        wandboxData.code = fileContents[firstFileName];
    }

    const response = await fetch('https://wandbox.org/api/compile.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(wandboxData),
    });

    if (!response.ok) {
        throw new Error(`网络请求失败: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    const output = result.program_output || result.compiler_output || '';

    return {
        success: result.status === '0',
        output,
        error: result.program_error || result.compiler_error,
        signal: result.signal,
        status: result.status
    };
};

export const runCode = async (
    fileContents: Record<string, string>,
    stdin: string,
    language: string,
    compileOptions: string
): Promise<RunResult> => {
    const compiler = await getLatestCompiler(language);
    return executeWandbox(compiler, fileContents, stdin, compileOptions);
};

export const runSingleTest = async (
    compiler: string,
    fileContents: Record<string, string>,
    input: string,
    compileOptions: string
): Promise<{ success: boolean; output: string; error?: string }> => {
    try {
        const result = await executeWandbox(compiler, fileContents, input, compileOptions);
        return {
            success: result.success,
            output: result.output.trim(),
            error: result.error
        };
    } catch (error) {
        console.error('运行测试用例失败:', error);
        return {
            success: false,
            output: '',
            error: '运行测试用例时发生错误'
        };
    }
};

// 运行所有测试用例
export const runAllTests = async (
    fileContents: Record<string, string>,
    inputs: string[],
    outputs: string[],
    language: string,
    compileOptions: string
): Promise<RunResult> => {
    const compiler = await getLatestCompiler(language);
    const testResults: TestCaseResult[] = [];
    let allTestsPassed = true;

    // 运行每个测试用例
    for (let i = 0; i < inputs.length; i++) {
        const input = inputs[i];
        const expectedOutput = outputs[i].trim();

        const result = await runSingleTest(compiler, fileContents, input, compileOptions);

        const passed = result.success && result.output.trim() === expectedOutput;

        if (!passed) {
            allTestsPassed = false;
        }

        testResults.push({
            input,
            expectedOutput,
            actualOutput: result.output,
            passed
        });
    }

    return {
        success: allTestsPassed,
        output: `测试完成：通过 ${testResults.filter(t => t.passed).length}/${testResults.length} 个测试用例`,
        testResults,
        allTestsPassed
    };
};