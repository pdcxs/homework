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

export const EXTENSION_MAP: Record<string, string> = {
    'c': 'c',
    'cc': 'cpp',
    'h': 'cpp',
    'hpp': 'cpp',
    'cpp': 'cpp',
    'java': 'java',
    'py': 'python',
    'cs': 'csharp',
    'go': 'go',
    'hs': 'haskell',
    'lisp': 'lisp',
    'js': 'javascript',
    'ts': 'typescript',
    'html': 'html',
    'css': 'css',
    'json': 'json',
    'xml': 'xml',
    'md': 'markdown',
    'txt': 'text',
    'rs': 'rust',
    'php': 'php',
    'rb': 'ruby',
    'sh': 'bash',
    'sql': 'sql'
};

export const getLanguageByFileName = (fileName: string): string => {
    const extension = fileName.toLowerCase().split('.').pop() || '';
    return EXTENSION_MAP[extension] || 'text';
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
    const cppFiles = Object.keys(fileContents).filter(file =>
        file.endsWith('.cpp') || file.endsWith('.cc') || file.endsWith('.c')
    );

    const mainFile = cppFiles.find(file =>
        file.startsWith("prog.")
    ) || Object.keys(fileContents)[0];

    const additionalCppFiles = cppFiles.filter(file => file !== mainFile);

    const wandboxData = {
        compiler,
        code: fileContents[mainFile],
        codes: Object.entries(fileContents)
            .filter(([fileName]) => fileName !== mainFile)
            .map(([fileName, content]) => ({
                file: fileName,
                code: content
            })),
        options: "",
        stdin,
        "compiler-option-raw": compileOptions + additionalCppFiles.join('\n'),
        "runtime-option-raw": ""
    };

    const response = await fetch('https://wandbox.org/api/compile.ndjson', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(wandboxData),
    });

    if (!response.ok) {
        throw new Error(`网络请求失败: ${response.status} ${response.statusText}`);
    }

    const responseText = await response.text();
    const lines = responseText.trim().split('\n');

    let programOutput = '';
    let compilerOutput = '';
    let programError = '';
    let signal = '';
    let status = '';
    let success = false;

for (const line of lines) {
        try {
            const event = JSON.parse(line);
            
            switch (event.type) {
                case 'StdOut':
                    programOutput += event.data;
                    break;
                case 'StdErr':
                    programError += event.data;
                    break;
                case 'CompilerMessageE':
                    compilerOutput += event.data + '\n';
                    break;
                case 'ExitCode':
                    status = event.data;
                    success = event.data === '0';
                    break;
                case 'Signal':
                    signal = event.data;
                    break;
                case 'Control':
                    break;
                default:
                    console.log('未知事件类型:', event.type, event);
            }
        } catch (e) {
            console.warn('解析 Wandbox 事件失败:', e, '原始内容:', line);
        }
    }

    let finalOutput = '';
    let finalError = '';
    
    if (success) {
        finalOutput = programOutput.trim();
        finalError = compilerOutput.trim() || programError.trim();
    } else {
        finalOutput = programOutput.trim();
        finalError = (compilerOutput.trim() + (compilerOutput && programError ? '\n' : '') + programError.trim()).trim();
    }

    return {
        success,
        output: finalOutput,
        error: finalError || undefined,
        signal: signal || undefined,
        status
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