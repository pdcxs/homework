// pages/StudentReview.page.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    Paper,
    Title,
    Container,
    Text,
    Flex,
    Stack,
    LoadingOverlay,
    Button,
    Table,
    Badge,
    Alert
} from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { useAuth } from '@/App';
import { EXTENSION_MAP, getLanguageByFileName } from '@/lib/wandbox';
import { FileContent, Review } from '@/lib/review';

// 声明全局 typst 类型
declare global {
    interface Window {
        $typst: any;
        TypstSnippet?: any;
        __typstInitialized?: boolean;
    }
}

const StudentReviewPage: React.FC = () => {
    const { supabaseClient, session } = useAuth();
    const [reviews, setReviews] = useState<Review[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [pdfLoading, setPdfLoading] = useState<number | null>(null);
    const [typstLoaded, setTypstLoaded] = useState(false);
    const [typstError, setTypstError] = useState<string | null>(null);

    const fileCacheRef = useRef<Record<number, FileContent[]>>({});
    const fetchedReviewsRef = useRef(false);
    const scriptRef = useRef<HTMLScriptElement | null>(null);
    const isMountedRef = useRef(true);

    // 清理函数
    useEffect(() => {
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    // 简化的 Typst 初始化 - 避免复杂的配置
    useEffect(() => {
        if (scriptRef.current || window.__typstInitialized) {
            if (window.__typstInitialized) {
                setTypstLoaded(true);
            }
            return;
        }

        const initializeTypst = async () => {
            try {
                if (window.$typst && !window.$typst.__initialized) {
                    if (typeof window.$typst.init === 'function') {
                        await window.$typst.init({
                            compiler: {
                                getModule: () =>
                                    'https://cdn.jsdelivr.net/npm/@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm',
                            },
                            renderer: {
                                getModule: () =>
                                    'https://cdn.jsdelivr.net/npm/@myriaddreamin/typst-ts-renderer/pkg/typst_ts_renderer_bg.wasm',
                            },
                        });
                    } else {
                        // 回退到旧 API，但尽量减少配置
                        window.$typst.setCompilerInitOptions?.({
                            getModule: () =>
                                'https://cdn.jsdelivr.net/npm/@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm',
                        });

                        window.$typst.setRendererInitOptions?.({
                            getModule: () =>
                                'https://cdn.jsdelivr.net/npm/@myriaddreamin/typst-ts-renderer/pkg/typst_ts_renderer_bg.wasm',
                        });
                    }

                    // 配置包注册表
                    if (window.TypstSnippet && window.TypstSnippet.fetchPackageRegistry) {
                        console.log('Configuring package registry...');
                        try {
                            const registry = await window.TypstSnippet.fetchPackageRegistry();
                            window.$typst?.use?.(registry);
                            console.log('Package registry configured successfully');
                        } catch (registryError) {
                            console.warn('Package registry configuration failed:', registryError);
                        }
                    } else {
                        console.warn('TypstSnippet.fetchPackageRegistry not available, package imports may fail');
                    }

                    // 预加载字体资源
                    if (window.TypstSnippet && window.TypstSnippet.preloadFontAssets) {
                        try {
                            window.$typst?.use?.(
                                window.TypstSnippet.preloadFontAssets({ assets: ['text', 'cjk'] })
                            );
                            console.log('Font assets preloaded');
                        } catch (fontError) {
                            console.warn('Font preloading failed:', fontError);
                        }
                    }

                    window.$typst.__initialized = true;
                    window.__typstInitialized = true;

                    if (isMountedRef.current) {
                        setTypstLoaded(true);
                        setTypstError(null);
                    }
                    console.log('Typst 初始化成功');
                }
            } catch (err) {
                console.error('Typst 初始化失败:', err);
                if (isMountedRef.current) {
                    setTypstError('Typst 初始化失败: ' + (err as Error).message);
                }
            }
        };

        if (window.$typst) {
            initializeTypst();
            return;
        }

        const script = document.createElement('script');
        script.type = 'module';
        script.src = 'https://cdn.jsdelivr.net/npm/@myriaddreamin/typst.ts/dist/esm/contrib/all-in-one-lite.bundle.js';
        script.id = 'typst';
        script.crossOrigin = 'anonymous';

        script.onload = () => {
            setTimeout(() => {
                initializeTypst();
            }, 100);
        };

        script.onerror = () => {
            console.error('加载 Typst 脚本失败');
            if (isMountedRef.current) {
                setTypstError('加载 Typst 编译器失败，请检查网络连接');
            }
        };

        document.head.appendChild(script);
        scriptRef.current = script;

        // 不在卸载时移除脚本，避免重复加载问题
    }, []);

    const fetchReviews = useCallback(async () => {
        if (fetchedReviewsRef.current) {
            return;
        }

        try {
            if (!isMountedRef.current) return;

            setLoading(true);
            setError(null);

            if (!session) {
                throw new Error('用户未登录');
            }

            console.log('开始获取批改记录...');
            const { data: checks, error: checksError } = await supabaseClient
                .from('checks')
                .select(`
                    id,
                    grade,
                    total_comment,
                    comments_contents,
                    comments_files,
                    comments_lines,
                    created_at,
                    answers (
                        id,
                        submitted_at,
                        storage_path,
                        homeworks (
                            id,
                            title
                        )
                    )
                `)
                .eq('answers.student_id', session.user.id)
                .order('created_at', { ascending: false });

            if (checksError) throw checksError;

            console.log('获取到的批改记录数量:', checks?.length || 0);

            const reviewData: Review[] = (checks || []).map((check: any) => ({
                id: check.id,
                homework_title: check.answers.homeworks.title,
                graded_at: check.created_at,
                grade: check.grade,
                total_comment: check.total_comment || '',
                comments: (check.comments_contents || []).map((content: string, index: number) => ({
                    content,
                    file: check.comments_files?.[index] || '',
                    line: check.comments_lines?.[index] || 0
                })),
                storage_path: check.answers.storage_path
            }));

            if (isMountedRef.current) {
                setReviews(reviewData);
                fetchedReviewsRef.current = true;
                console.log('批改记录设置完成');
            }
        } catch (err: any) {
            console.error('获取批改记录失败:', err);
            if (isMountedRef.current) {
                setError(`获取批改记录失败: ${err.message}`);
            }
        } finally {
            if (isMountedRef.current) {
                setLoading(false);
            }
        }
    }, [session, supabaseClient]);

    useEffect(() => {
        if (session && !fetchedReviewsRef.current) {
            fetchReviews();
        }
    }, [session, fetchReviews]);

    const fetchFileContents = async (storagePath: string): Promise<FileContent[]> => {
        try {
            console.log('获取文件内容，路径:', storagePath);
            const { data: files, error: filesError } = await supabaseClient
                .storage
                .from('homework')
                .list(storagePath);

            if (filesError) {
                console.error('获取文件列表失败:', filesError);
                return [];
            }

            console.log('找到的文件数量:', files?.length || 0);

            const fileContents: FileContent[] = [];
            for (const file of files || []) {
                try {
                    const filePath = `${storagePath}/${file.name}`;
                    const { data: fileData, error: downloadError } = await supabaseClient
                        .storage
                        .from('homework')
                        .download(filePath);
                    if (!downloadError && fileData) {
                        const text = await fileData.text();
                        fileContents.push({
                            file_name: file.name,
                            file_content: text,
                            editable: false
                        });
                        console.log(`成功读取文件: ${file.name}`);
                    }
                } catch (fileErr) {
                    console.error(`读取文件 ${file.name} 失败:`, fileErr);
                }
            }
            return fileContents;
        } catch (err) {
            console.error('获取文件内容失败:', err);
            return [];
        }
    };

    const generateTypstSource = (review: Review, files: FileContent[]): string => {
        if (!review) return '';

        let source = `#import "@preview/zebraw:0.6.0": *\n\n`;
        source += `#set page(margin: 1in)\n\n`;
        source += `#show heading.where(level: 1): set text(size: 30pt)\n\n`
        source += `#show heading.where(level: 2): set text(size: 20pt)\n\n`
        source += `#set text(size: 15pt)\n\n`
        source += `= ${review.homework_title}\n\n`;
        source += `== 评分\n\n`
        source += `#box(stroke: black, inset: 10pt)[*${review.grade}*]\n\n`;
        source += `== 总体评语\n\n${review.total_comment}\n\n`;

        files.forEach((file) => {
            source += `== ${file.file_name}\n\n`;
            const fileComments = review.comments.filter(comment => comment.file === file.file_name);

            source += `#zebraw(\n`;
            if (fileComments.length > 0) {
                source += `  highlight-lines: (\n`;

                fileComments.forEach((comment) => {
                    const escapedComment = comment.content
                        .replace(/"/g, '\\"')
                        .replace(/\n/g, '\\n');
                    source += `    (${comment.line}, "${escapedComment}"),\n`;
                });

                source += `  ),\n`;
            }

            const codeContent = file.file_content
                .replace(/\\/g, '\\\\')
                .replace(/`/g, '\\`');

            // 根据文件扩展名动态设置语言
            const language = getLanguageByFileName(file.file_name);
            source += `  \`\`\`${language}\n` + codeContent + '\n  ```\n)\n\n';
        });

        console.log(source)

        return source;
    };

    // 在新标签页打开 PDF
    const openPdfInNewTab = async (review: Review) => {
        if (!review) {
            setError('未选择批改记录');
            return;
        }

        if (!typstLoaded) {
            setError('Typst 编译器正在加载中，请稍后重试');
            return;
        }

        if (!window.$typst) {
            setError('Typst 编译器未正确加载');
            return;
        }

        if (pdfLoading === review.id) {
            return;
        }

        setPdfLoading(review.id);
        setError(null);

        let pdfUrl: string | null = null;

        try {
            console.log('开始获取文件内容...');

            let files: FileContent[];
            if (fileCacheRef.current[review.id]) {
                console.log('使用缓存的文件内容');
                files = fileCacheRef.current[review.id];
            } else {
                console.log('下载文件内容...');
                files = await fetchFileContents(review.storage_path);
                fileCacheRef.current[review.id] = files;
            }

            if (files.length === 0) {
                throw new Error('未找到作业文件');
            }

            console.log('开始生成 Typst 源代码...');
            const source = generateTypstSource(review, files);
            console.log('Typst 源代码生成完成，开始编译...');

            const pdfData = await window.$typst.pdf({ mainContent: source });
            console.log('PDF 编译完成，大小:', pdfData.length);

            const pdfFile = new Blob([pdfData], { type: 'application/pdf' });
            pdfUrl = URL.createObjectURL(pdfFile);

            const newWindow = window.open(pdfUrl, '_blank');

            if (!newWindow) {
                setError('请允许弹出窗口以查看 PDF');
                return;
            }

            // 简化的窗口关闭监听
            const cleanup = () => {
                if (pdfUrl) {
                    URL.revokeObjectURL(pdfUrl);
                }
            };

            // 5秒后自动清理，无论窗口是否关闭
            setTimeout(cleanup, 5000);

        } catch (err: any) {
            console.error('生成 PDF 失败:', err);
            if (isMountedRef.current) {
                setError('生成 PDF 失败: ' + (err as Error).message);
            }
        } finally {
            if (isMountedRef.current) {
                setPdfLoading(null);
            }
        }
    };

    // 渲染编译器状态提示
    const renderCompilerStatus = () => {
        if (typstError) {
            return (
                <Alert icon={<IconAlertCircle size={16} />} title="编译器加载失败" color="red" mb="md">
                    {typstError}
                    <Button
                        size="xs"
                        variant="light"
                        onClick={() => window.location.reload()}
                        ml="sm"
                    >
                        重试
                    </Button>
                </Alert>
            );
        }

        if (!typstLoaded) {
            return (
                <Alert icon={<IconAlertCircle size={16} />} title="编译器加载中" color="blue" mb="md">
                    Typst 编译器正在加载，请稍等片刻...
                </Alert>
            );
        }

        return null;
    };

    if (loading) {
        return (
            <Container size="lg" py="xl">
                <Paper p="xl" withBorder style={{ position: 'relative', height: '200px' }}>
                    <LoadingOverlay visible={loading} />
                </Paper>
            </Container>
        );
    }

    return (
        <Container size="xl" py="xl">
            <Stack gap="xl">
                <Flex justify="space-between" align="center">
                    <div>
                        <Title order={2}>作业批改</Title>
                        <Text c="dimmed">查看教师批改反馈</Text>
                    </div>
                    <Text c="dimmed">
                        共 {reviews.length} 份批改
                    </Text>
                </Flex>

                {renderCompilerStatus()}

                {error && (
                    <Alert icon={<IconAlertCircle size={16} />} title="错误" color="red">
                        {error}
                    </Alert>
                )}

                <Paper withBorder pos="relative">
                    <LoadingOverlay visible={loading} />
                    <Table>
                        <Table.Thead>
                            <Table.Tr>
                                <Table.Th>作业名称</Table.Th>
                                <Table.Th>批改时间</Table.Th>
                                <Table.Th>评分</Table.Th>
                                <Table.Th>操作</Table.Th>
                            </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                            {reviews.length === 0 ? (
                                <Table.Tr>
                                    <Table.Td colSpan={4} style={{ textAlign: 'center', padding: '2rem' }}>
                                        <Text c="dimmed">
                                            {loading ? '加载中...' : '暂无批改记录'}
                                        </Text>
                                    </Table.Td>
                                </Table.Tr>
                            ) : (
                                reviews.map((review) => (
                                    <Table.Tr
                                        key={review.id}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <Table.Td>
                                            <Text fw={500}>{review.homework_title}</Text>
                                        </Table.Td>
                                        <Table.Td>
                                            <Text size="sm">
                                                {new Date(review.graded_at).toLocaleString('zh-CN')}
                                            </Text>
                                        </Table.Td>
                                        <Table.Td>
                                            <Badge color="blue" variant="light">
                                                {review.grade}
                                            </Badge>
                                        </Table.Td>
                                        <Table.Td>
                                            <Button
                                                variant="light"
                                                size="xs"
                                                loading={pdfLoading === review.id}
                                                disabled={!typstLoaded || !!typstError}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    openPdfInNewTab(review);
                                                }}
                                            >
                                                {!typstLoaded ? '加载中...' : '查看详情'}
                                            </Button>
                                        </Table.Td>
                                    </Table.Tr>
                                ))
                            )}
                        </Table.Tbody>
                    </Table>
                </Paper>
            </Stack>
        </Container>
    );
};

export default StudentReviewPage;