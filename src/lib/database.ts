import { SupabaseClient } from '@supabase/supabase-js';
import { FileContent, Review } from './review';

export interface HomeworkFile {
    id: bigint;
    homework_id: bigint;
    file_name: string;
    file_content: string;
    editable: boolean;
    custom_id: string;
    is_custom: boolean;
}

export interface HomeworkDetails {
    id: bigint;
    course_id: bigint;
    title: string;
    description: string;
    deadline: string;
    course_name: string;
    language: string;
    result?: string;
    compile_options?: string;
    inputs?: string[];
    outputs?: string[];
}

export interface UserProfile {
    id: string;
    name: string;
    student_id: string;
    class_id: number;
    class_name: string,
}

// 获取作业详情
export const fetchHomeworkData = async (
    supabase: SupabaseClient,
    homeworkId: string
): Promise<{ homework: HomeworkDetails; files: HomeworkFile[] } | null> => {
    try {
        // 获取作业详情
        const { data: homeworkData } = await supabase
            .from('homeworks')
            .select(`
                *,
                courses(name, language)
            `)
            .eq('id', homeworkId)
            .single();

        if (!homeworkData) return null;

        const homework: HomeworkDetails = {
            id: homeworkData.id,
            course_id: homeworkData.course_id,
            title: homeworkData.title,
            description: homeworkData.description,
            deadline: homeworkData.deadline,
            course_name: homeworkData.courses.name,
            language: homeworkData.courses.language,
            compile_options: homeworkData.compile_options,
            inputs: homeworkData.inputs,
            outputs: homeworkData.outputs,
        };

        // 获取作业文件
        const { data: filesData } = await supabase
            .from('homework_files')
            .select('*')
            .eq('homework_id', homeworkId)
            .order('id');

        return {
            homework,
            files: filesData || []
        };
    } catch (error) {
        console.error('获取作业数据失败:', error);
        return null;
    }
};

// 获取用户信息
export const fetchUserProfile = async (
    supabase: SupabaseClient,
    userId: string
): Promise<UserProfile | null> => {
    try {
        const { data: profileData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        return profileData;
    } catch (error) {
        console.error('获取用户信息失败:', error);
        return null;
    }
};

// 检查之前的提交
export const checkPreviousSubmission = async (
    supabase: SupabaseClient,
    homeworkId: string,
    userId: string
): Promise<{ hasSubmission: boolean; storagePath?: string }> => {
    try {
        // 检查 URL 参数中是否有 answer_id
        const searchParams = new URLSearchParams(window.location.search);
        const answerId = searchParams.get('answer_id');

        let answerData;

        if (answerId) {
            // 如果有 answer_id，获取特定的答案记录
            const { data } = await supabase
                .from('answers')
                .select('*')
                .eq('id', answerId)
                .eq('student_id', userId)
                .single();
            answerData = data;
        } else {
            // 否则获取最新的答案记录
            const { data } = await supabase
                .from('answers')
                .select('*')
                .eq('homework_id', homeworkId)
                .eq('student_id', userId)
                .order('submitted_at', { ascending: false })
                .limit(1)
                .single();
            answerData = data;
        }

        if (answerData && answerData.storage_path) {
            return {
                hasSubmission: true,
                storagePath: answerData.storage_path
            };
        }

        return { hasSubmission: false };
    } catch (error) {
        console.error('检查之前提交失败:', error);
        return { hasSubmission: false };
    }
};

export const loadSubmittedFiles = async (
    supabase: SupabaseClient,
    storagePath: string
): Promise<Record<string, string>> => {
    try {
        const { data: filesList, error: listError } = await supabase.storage
            .from('homework')
            .list(storagePath);

        if (listError) {
            console.error('列出文件失败:', listError);
            throw listError;
        }

        const submittedContents: Record<string, string> = {};

        if (filesList && filesList.length > 0) {
            // 下载每个文件的内容
            for (const file of filesList) {
                const filePath = `${storagePath}/${file.name}`;

                const { data: signed, error: signError } = await supabase.storage
                    .from('homework').createSignedUrl(filePath, 30);

                if (signError || !signed?.signedUrl) continue;

                const resp = await fetch(signed.signedUrl);
                const text = await resp.text();

                submittedContents[file.name] = text;
            }
        }

        return submittedContents;
    } catch (error) {
        console.error('加载已提交文件失败:', error);
        return {};
    }
};

export const submitHomework = async (
    supabase: SupabaseClient,
    homeworkId: bigint,
    userId: string,
    fileContents: Record<string, string>,
    language?: string,
    result?: string,
): Promise<boolean> => {
    try {
        const storagePath = `${userId}/${homeworkId}`;

        // 删除存储路径下的所有文件
        const { data: existingFiles, error: listError } = await supabase.storage
            .from('homework')
            .list(storagePath);

        if (listError && listError.message !== 'Not Found') {
            console.error('列出现有文件失败:', listError);
            throw listError;
        }

        if (existingFiles && existingFiles.length > 0) {
            const filesToDelete = existingFiles.map(file => `${storagePath}/${file.name}`);
            const { error: deleteError } = await supabase.storage
                .from('homework')
                .remove(filesToDelete);

            if (deleteError) {
                console.error('删除旧文件失败:', deleteError);
                throw deleteError;
            }
        }

        // 上传所有当前文件到存储
        for (const [fileName, content] of Object.entries(fileContents)) {
            const filePath = `${storagePath}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('homework')
                .upload(filePath, new Blob([content], { type: 'text/plain' }), {
                    upsert: true,
                    cacheControl: 'no-cache',
                });

            if (uploadError) {
                console.error(`上传文件 ${fileName} 失败:`, uploadError);
                throw uploadError;
            }
        }

        // 创建或更新答案记录
        const { error: answerError } = await supabase
            .from('answers')
            .upsert({
                homework_id: homeworkId,
                student_id: userId,
                storage_path: storagePath,
                submitted_at: new Date().toISOString(),
                result: result,
                language: language,
            }, {
                onConflict: 'homework_id,student_id'
            });

        if (answerError) {
            console.error('更新答案记录失败:', answerError);
            throw answerError;
        }

        return true;
    } catch (error) {
        console.error('提交作业失败:', error);
        return false;
    }
};

export const fetchStudentReviews = async (
    supabaseClient: SupabaseClient,
    studentId: string
): Promise<Review[]> => {
    try {
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
        answers!inner(
          id,
          submitted_at,
          storage_path,
          homeworks!inner(
            id,
            title,
            courses!inner(
              name
            )
          )
        )
      `)
            .eq('answers.student_id', studentId)
            .order('created_at', { ascending: false });

        if (checksError) throw checksError;

        console.log('获取到的批改记录数量:', checks?.length || 0);

        const reviewData: Review[] = (checks || []).map((check: any) => ({
            id: check.id,
            homework_title: check.answers.homeworks.title,
            course_name: check.answers.homeworks.courses.name,
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

        return reviewData;
    } catch (err: any) {
        console.error('获取批改记录失败:', err);
        throw new Error(`获取批改记录失败: ${err.message}`);
    }
};

/**
 * 获取文件内容
 */
export const fetchFileContents = async (
    supabaseClient: SupabaseClient,
    storagePath: string
): Promise<FileContent[]> => {
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

export const getUniqueCourseNames = (reviews: Review[]): string[] => {
    const courseNames = reviews.map(review => review.course_name);
    return [...new Set(courseNames)].filter(Boolean);
};