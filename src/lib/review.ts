// /src/lib/review.ts
import { getLanguageByFileName } from "./wandbox";

export interface Review {
    id: number;
    homework_title: string;
    course_name: string;
    graded_at: string;
    grade: string;
    total_comment: string;
    comments: Comment[];
    storage_path: string;
    description: string;
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
