// /src/lib/typst.ts
import { getLanguageByFileName } from './wandbox';
import { FileContent, Review } from './review';

declare global {
    interface Window {
        $typst: any;
        TypstSnippet?: any;
        __typstInitialized?: boolean;
    }
}

interface TypstInitOptions {
    onSuccess?: () => void;
    onError?: (error: string) => void;
}

export const initializeTypst = async (options?: TypstInitOptions): Promise<boolean> => {
    try {
        if (window.$typst && !window.$typst.__initialized) {
            let providers = [];
            if (window.TypstSnippet?.fetchPackageRegistry) {
                providers.push(window.TypstSnippet.fetchPackageRegistry);
            }

            if (window.TypstSnippet?.preloadFontAssets) {
                providers.push(window.TypstSnippet.preloadFontAssets({ assets: ['text', 'cjk'] }));
            }

            window.$typst.use(...providers);

            window.$typst.setCompilerInitOptions?.({
                beforeBuild: [],
                getModule: () =>
                    'https://cdn.jsdelivr.net/npm/@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm',
            });

            window.$typst.setRendererInitOptions?.({
                beforeBuild: [],
                getModule: () =>
                    'https://cdn.jsdelivr.net/npm/@myriaddreamin/typst-ts-renderer/pkg/typst_ts_renderer_bg.wasm',
            });

            // // 配置包注册表
            // if (window.TypstSnippet && window.TypstSnippet.fetchPackageRegistry) {
            //     const registry = await window.TypstSnippet.fetchPackageRegistry();
            //     window.$typst?.use?.(registry);
            //     console.log('Package registry configured successfully');
            // }

            // // 预加载字体资源
            // if (window.TypstSnippet && window.TypstSnippet.preloadFontAssets) {
            //     window.$typst?.use?.(
            //         window.TypstSnippet.preloadFontAssets({ assets: ['text', 'cjk'] })
            //     );
            //     console.log('Font assets preloaded');
            // }

            window.$typst.__initialized = true;
            window.__typstInitialized = true;

            console.log('Typst 初始化成功');
            options?.onSuccess?.();
            return true;
        }
        return false;
    } catch (err) {
        console.error('Typst 初始化失败:', err);
        options?.onError?.(`Typst 初始化失败: ${(err as Error).message}`);
        return false;
    }
};

export const loadTypstScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
        if (window.$typst) {
            resolve(true);
            return;
        }

        const script = document.createElement('script');
        script.type = 'module';
        script.src = 'https://cdn.jsdelivr.net/npm/@myriaddreamin/typst.ts/dist/esm/contrib/all-in-one-lite.bundle.js';
        script.id = 'typst';
        script.crossOrigin = 'anonymous';

        script.onload = () => {
            setTimeout(() => {
                resolve(true);
            }, 100);
        };

        script.onerror = () => {
            console.error('加载 Typst 脚本失败');
            resolve(false);
        };

        document.head.appendChild(script);
    });
};

export const generateTypstSource = (review: Review, files: FileContent[]): string => {
    if (!review) return '';

    let source = `#import "@preview/zebraw:0.6.0": *\n\n`;
    source += `#import "@preview/cmarker:0.1.6"\n\n`
    source += `#import "@preview/mitex:0.2.5": mitex\n\n`
    source += `#set page(margin: 1in)\n\n`;
    source += `#show heading.where(level: 1): set text(size: 30pt)\n\n`;
    source += `#show heading.where(level: 1): it => { align(center, it)}\n\n`;
    source += `#show heading.where(level: 2): set text(size: 20pt)\n\n`;
    source += `#set heading(numbering: (..nums) => { if nums.pos().len() == 2 {return str(nums.pos().last()) + ". "} else {return ""}})\n\n`;
    source += `#set par(first-line-indent: (amount: 2em, all: true))\n\n`;
    source += `#set text(size: 15pt)\n\n`;
    source += `= ${review.homework_title}\n\n`;
    source += `== 评分\n\n`;
    source += `#box(stroke: black, inset: 10pt)[*${review.grade}*]\n\n`;
    source += `== 总体评语\n\n${review.total_comment}\n\n`;
    source += `== 作业内容\n\n`;
    source += `#block(stroke: 1pt + black, inset: 2em, breakable: true, width: 100%)[\n`;
    source += `#cmarker.render("${review.description
        .replaceAll(`"`, `\\"`)
        .replace(/^# (.+)/, '### $1')
        .replace(/^## (.+)/, '#### $1')
        .replace(/^### (.+)/, '#### $1')}", math: mitex)\n\n`;
    source += `]\n\n`;
    source += `== 源程序\n\n`;

    files.forEach((file) => {
        source += `=== ${file.file_name}\n\n`;
        const fileComments = review.comments.filter(comment => comment.file === file.file_name);

        source += `#zebraw(\n`;
        source += `  comment-font-args: (font: "Noto Serif CJK SC"),\n`;
        source += `  lang-font-args: (font: "Noto Serif CJK SC"),\n`;
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

        const language = getLanguageByFileName(file.file_name);
        source += `  \`\`\`${language}\n` + codeContent + '\n  ```\n)\n\n';
    });

    console.log('生成的 Typst 源代码:', source);
    return source;
};

export const generatePdf = async (source: string): Promise<any> => {
    if (!window.$typst) {
        throw new Error('Typst 编译器未正确加载');
    }

    const pdfData = await window.$typst.pdf({ mainContent: source });
    console.log('PDF 编译完成，大小:', pdfData.length);
    return pdfData;
};

export const openPdf = (pdfData: any): boolean => {
    const pdfFile = new Blob([pdfData], { type: 'application/pdf' });
    const pdfUrl = URL.createObjectURL(pdfFile);
    window.location.href = pdfUrl;

    return true;
};