// =============================================================================
// Ocular — PDF Extractor (TypeScript ↔ Python bridge)
// =============================================================================

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import type { PyMuPDFResult, Logger } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Default: python/ directory adjacent to dist/
const DEFAULT_PYTHON_DIR = path.resolve(__dirname, '..', 'python');

const defaultLogger: Logger = {
    info: () => { },
    warn: (msg, meta) => console.warn(`[ocular] ${msg}`, meta || ''),
    error: (msg, meta) => console.error(`[ocular] ${msg}`, meta || ''),
};

export interface ExtractorOptions {
    /** Path to the Python scripts directory (default: ./python relative to package root) */
    pythonDir?: string;
    /** Path to the Python binary (default: auto-detect venv or system python3) */
    pythonBin?: string;
    /** Logger instance (default: console warnings + errors only) */
    logger?: Logger;
}

/**
 * Find the best Python binary to use.
 * Priority: explicit option → venv in pythonDir → system python3
 */
function resolvePythonBin(options: ExtractorOptions): string {
    if (options.pythonBin) return options.pythonBin;

    const pythonDir = options.pythonDir || DEFAULT_PYTHON_DIR;
    const venvPython = path.join(pythonDir, 'venv', 'bin', 'python');

    // Check if venv exists (best effort — spawn will fail gracefully if not)
    return venvPython;
}

/**
 * Run the Python PDF extractor script and return the parsed result.
 * @internal
 */
async function runPythonExtractor(
    args: string[],
    stdinData?: Buffer,
    options: ExtractorOptions = {}
): Promise<PyMuPDFResult> {
    const pythonDir = options.pythonDir || DEFAULT_PYTHON_DIR;
    const pythonBin = resolvePythonBin(options);
    const scriptPath = path.join(pythonDir, 'pdf_extractor.py');
    const log = options.logger || defaultLogger;

    return new Promise((resolve) => {
        const proc = spawn(pythonBin, [scriptPath, ...args], {
            cwd: pythonDir,
            env: { ...process.env },
        });

        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data) => { stdout += data.toString(); });
        proc.stderr.on('data', (data) => { stderr += data.toString(); });

        proc.on('close', (code) => {
            if (code !== 0) {
                log.error('Python PDF extractor failed', { code, stderr: stderr.slice(0, 500) });
                resolve({ success: false, markdown: '', pages: 0, error: stderr || `Exit code ${code}` });
                return;
            }

            try {
                const parsed = JSON.parse(stdout);
                resolve({
                    success: parsed.success !== false,
                    markdown: parsed.markdown || '',
                    pages: parsed.pages || 0,
                    page_data: parsed.page_data,
                    error: parsed.error,
                });
            } catch (parseError) {
                log.error('Failed to parse Python output', { stdoutLength: stdout.length });
                resolve({ success: false, markdown: '', pages: 0, error: 'Failed to parse output' });
            }
        });

        proc.on('error', (error) => {
            log.error('Failed to spawn Python', { error: error.message });
            resolve({
                success: false,
                markdown: '',
                pages: 0,
                error: `Failed to spawn Python: ${error.message}. Is Python3 + pymupdf installed?`,
            });
        });

        if (stdinData) {
            proc.stdin.write(stdinData.toString('base64'));
            proc.stdin.end();
        }
    });
}

/**
 * Extract a PDF from a file path.
 *
 * @param pdfPath - Absolute path to the PDF file
 * @param options - Extractor options
 * @returns PyMuPDF extraction result with markdown + page_data
 *
 * @example
 * ```ts
 * const result = await extractPdfFromPath('/path/to/doc.pdf');
 * console.log(result.markdown);      // LLM-ready text with [PAGE_X] markers
 * console.log(result.page_data);     // Span positions for highlighting
 * ```
 */
export async function extractPdfFromPath(
    pdfPath: string,
    options: ExtractorOptions = {}
): Promise<PyMuPDFResult> {
    return runPythonExtractor([pdfPath], undefined, options);
}

/**
 * Extract a PDF from an in-memory buffer.
 *
 * @param buffer - PDF file contents as a Buffer
 * @param options - Extractor options
 * @returns PyMuPDF extraction result with markdown + page_data
 *
 * @example
 * ```ts
 * const buffer = fs.readFileSync('policy.pdf');
 * const result = await extractPdfFromBuffer(buffer);
 * ```
 */
export async function extractPdfFromBuffer(
    buffer: Buffer,
    options: ExtractorOptions = {}
): Promise<PyMuPDFResult> {
    return runPythonExtractor(['--stdin', '--stdout'], buffer, options);
}
