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
    Alert,
    Select
} from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { useAuth } from '@/App';
import { FileContent, Review } from '@/lib/review';
import { fetchStudentReviews, fetchFileContents, getUniqueCourseNames } from '@/lib/database';
import { initializeTypst, loadTypstScript, generateTypstSource, generatePdf, openPdfInNewTab } from '@/lib/typst';

const StudentReviewPage: React.FC = () => {
    const { supabaseClient: supabase, session } = useAuth();
    const [reviews, setReviews] = useState<Review[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [pdfLoading, setPdfLoading] = useState<number | null>(null);
    const [typstLoaded, setTypstLoaded] = useState(false);
    const [typstError, setTypstError] = useState<string | null>(null);
    const [selectedCourseName, setSelectedCourseName] = useState<string>("所有课程");
    const [filteredReviews, setFilteredReviews] = useState<Review[]>([]);
    const [courseNames, setCourseNames] = useState<string[]>([]);

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

    // 筛选 reviews
    useEffect(() => {
        if (selectedCourseName === "所有课程") {
            setFilteredReviews(reviews);
        } else {
            setFilteredReviews(reviews.filter((r) => r.course_name === selectedCourseName));
        }
    }, [selectedCourseName, reviews]);

    // 更新课程名称列表
    useEffect(() => {
        setCourseNames(["所有课程", ...getUniqueCourseNames(reviews)]);
    }, [reviews]);

    // 初始化 Typst
    useEffect(() => {
        const initTypst = async () => {
            if (scriptRef.current || window.__typstInitialized) {
                if (window.__typstInitialized) {
                    setTypstLoaded(true);
                }
                return;
            }

            const scriptLoaded = await loadTypstScript();
            if (!scriptLoaded) {
                setTypstError('加载 Typst 编译器失败，请检查网络连接');
                return;
            }

            const initialized = await initializeTypst({
                onSuccess: () => {
                    if (isMountedRef.current) {
                        setTypstLoaded(true);
                        setTypstError(null);
                    }
                },
                onError: (errorMsg) => {
                    if (isMountedRef.current) {
                        setTypstError(errorMsg);
                    }
                }
            });

            if (initialized && isMountedRef.current) {
                setTypstLoaded(true);
            }
        };

        initTypst();
    }, []);

    // 获取批改记录
    const fetchReviews = useCallback(async () => {
        if (fetchedReviewsRef.current || !session) {
            return;
        }

        try {
            if (!isMountedRef.current) return;

            setLoading(true);
            setError(null);

            const reviewData = await fetchStudentReviews(supabase, session.user.id);

            if (isMountedRef.current) {
                setReviews(reviewData);
                fetchedReviewsRef.current = true;
                console.log('批改记录设置完成');
            }
        } catch (err: any) {
            console.error('获取批改记录失败:', err);
            if (isMountedRef.current) {
                setError(err.message);
            }
        } finally {
            if (isMountedRef.current) {
                setLoading(false);
            }
        }
    }, [session]);

    useEffect(() => {
        if (session && !fetchedReviewsRef.current) {
            fetchReviews();
        }
    }, [session, fetchReviews]);

    // 在新标签页打开 PDF
    const handleOpenPdf = async (review: Review) => {
        if (!review) {
            setError('未选择批改记录');
            return;
        }

        if (!typstLoaded) {
            setError('Typst 编译器正在加载中，请稍后重试');
            return;
        }

        if (pdfLoading === review.id) {
            return;
        }

        setPdfLoading(review.id);
        setError(null);

        try {
            console.log('开始获取文件内容...');

            let files: FileContent[];
            if (fileCacheRef.current[review.id]) {
                console.log('使用缓存的文件内容');
                files = fileCacheRef.current[review.id];
            } else {
                console.log('下载文件内容...');
                files = await fetchFileContents(supabase, review.storage_path);
                fileCacheRef.current[review.id] = files;
            }

            if (files.length === 0) {
                throw new Error('未找到作业文件');
            }

            console.log('开始生成 Typst 源代码...');
            const source = generateTypstSource(review, files);

            console.log('开始编译 PDF...');
            const pdfData = await generatePdf(source);

            const opened = openPdfInNewTab(pdfData);
            if (!opened) {
                setError('请允许弹出窗口以查看 PDF');
            }
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
                        共 {filteredReviews.length} 份批改
                    </Text>
                </Flex>

                {renderCompilerStatus()}

                {error && (
                    <Alert icon={<IconAlertCircle size={16} />} title="错误" color="red">
                        {error}
                    </Alert>
                )}

                <Select
                    data={courseNames}
                    value={selectedCourseName}
                    onChange={(value) => setSelectedCourseName(value!)}
                    placeholder="选择课程"
                />

                <Paper withBorder pos="relative">
                    <LoadingOverlay visible={loading} />
                    <Table>
                        <Table.Thead>
                            <Table.Tr>
                                <Table.Th>作业名称</Table.Th>
                                <Table.Th>课程名称</Table.Th>
                                <Table.Th>批改时间</Table.Th>
                                <Table.Th>评分</Table.Th>
                                <Table.Th>操作</Table.Th>
                            </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                            {filteredReviews.length === 0 ? (
                                <Table.Tr>
                                    <Table.Td colSpan={5} style={{ textAlign: 'center', padding: '2rem' }}>
                                        <Text c="dimmed">
                                            {loading ? '加载中...' : '暂无批改记录'}
                                        </Text>
                                    </Table.Td>
                                </Table.Tr>
                            ) : (
                                filteredReviews.map((review) => (
                                    <Table.Tr
                                        key={review.id}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <Table.Td>
                                            <Text fw={500}>{review.homework_title}</Text>
                                        </Table.Td>
                                        <Table.Td>
                                            <Text fw={500}>{review.course_name}</Text>
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
                                                    handleOpenPdf(review);
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