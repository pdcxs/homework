import { getLanguageByFileName } from "./wandbox";

export interface Review {
    id: number;
    homework_title: string;
    graded_at: string;
    grade: string;
    total_comment: string;
    comments: Comment[];
    storage_path: string;
}

export interface Comment {
    content: string;
    file: string;
    line: number;
}

export interface FileContent {
    file_name: string;
    file_content: string;
    editable: boolean;
}

export const generateTypstSource = (review: Review, files: FileContent[]): string => {
    if (!review) return '';

    let source = `#import "@preview/zebraw:0.6.0": *\n\n`;
    source += `#set page(margin: 1in)\n\n`;
    source += `#show heading.where(level: 1): set text(size: 30pt)\n\n`
    source += `#show heading: set block(below: 1em)\n\n`
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
