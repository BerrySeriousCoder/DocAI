"use client";

import dynamic from "next/dynamic";
import { useAppStore } from "@/lib/store";
import UploadZone from "@/components/upload-zone";
import AuthGate from "@/components/auth-gate";
import { FileText, MessageSquareQuote, MousePointerClick } from "lucide-react";

const ChatPanel = dynamic(() => import("@/components/chat-panel"), { ssr: false });
const PdfViewer = dynamic(() => import("@/components/pdf-viewer"), { ssr: false });

export default function Home() {
  const { pdfUrl, indexId } = useAppStore();
  const hasDocument = pdfUrl && indexId;

  return (
    <AuthGate>
      <div className="h-screen flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="flex items-center justify-between px-8 py-4 border-b border-[var(--border-color)] bg-[var(--bg-primary)]">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">DocAI</h1>
          </div>
          {hasDocument && (
            <button
              onClick={() => useAppStore.getState().reset()}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors px-3 py-1.5 rounded-lg hover:bg-[var(--bg-tertiary)]"
            >
              New Document
            </button>
          )}
        </header>

        {/* Main Content */}
        {hasDocument ? (
          <div className="flex-1 flex overflow-hidden">
            {/* Left: Chat Panel (40%) */}
            <div className="w-[40%] border-r border-[var(--border-color)] bg-[var(--bg-secondary)] flex flex-col">
              <ChatPanel />
            </div>

            {/* Right: PDF Viewer (60%) */}
            <div className="w-[60%] flex flex-col">
              <PdfViewer />
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto scroll-smooth">
            {/* Hero Section */}
            <div className="max-w-7xl mx-auto px-6 py-12 md:py-24 flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
              
              {/* Left Column: Beautiful Hero & Explanation */}
              <div className="flex-1 w-full space-y-10">
                <div className="space-y-6">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--border-active)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-xs font-semibold tracking-wide">
                    <span className="w-2 h-2 rounded-full bg-[var(--text-primary)] animate-pulse"></span>
                    Highlight Resolution Engine
                  </div>
                  <h2 className="text-4xl md:text-6xl font-bold tracking-tight text-[var(--text-primary)] leading-[1.15]">
                    Extract. Chat.<br/>
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--text-primary)] to-[var(--text-muted)]">
                      Highlight Instantly.
                    </span>
                  </h2>
                  <p className="text-lg text-[var(--text-secondary)] leading-relaxed max-w-xl">
                    DocAI isn't just another document chatbot. It precisely maps the AI's answers back to exact coordinates in your PDF, highlighting the original text in real-time using a deterministic 3-tier matcher.
                  </p>
                </div>
              </div>

              {/* Right Column: Upload Zone Wrapper */}
              <div className="w-full lg:w-[480px] shrink-0">
                <div className="p-3 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] shadow-[0_0_80px_-20px_rgba(255,255,255,0.05)] relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-br from-[var(--border-active)] to-transparent opacity-0 group-hover:opacity-5 transition-opacity duration-1000 pointer-events-none"></div>
                  <div className="relative bg-[var(--bg-primary)] rounded-xl h-[450px] overflow-hidden">
                    <UploadZone />
                  </div>
                </div>
              </div>

            </div>

            {/* Deep Dive Article Section */}
            {/* Deep Dive Article Section */}
            <div className="border-t border-[var(--border-color)] bg-[var(--bg-secondary)] relative">
              <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5 pointer-events-none mix-blend-overlay"></div>
              
              <div className="max-w-5xl mx-auto px-6 py-24 space-y-24 relative z-10">
                
                {/* Header & The Problem */}
                <div className="space-y-12">
                  <div className="text-center space-y-6 max-w-3xl mx-auto">
                    <h2 className="text-4xl md:text-6xl font-bold text-[var(--text-primary)] tracking-tight">How DocAI Works</h2>
                    <p className="text-[var(--text-secondary)] text-lg md:text-xl leading-relaxed">A deep technical explanation of the full pipeline: extraction → AI context → coordinate resolution → highlighting.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-12 bg-[var(--bg-primary)] p-8 md:p-12 rounded-3xl border border-[var(--border-color)] shadow-xl">
                    <div className="space-y-4">
                      <h3 className="text-2xl font-bold text-[var(--text-primary)]">The Problem</h3>
                      <p className="text-[var(--text-secondary)] leading-relaxed text-lg">
                        When you send a PDF to an AI, it reads text. When it responds with insights, you want to highlight those exact passages on the original PDF. This is deceptively hard because:
                      </p>
                      <ul className="space-y-2 text-[var(--text-secondary)] list-disc pl-5 marker:text-[var(--border-active)]">
                        <li><strong>AI paraphrases:</strong> it rarely quotes text verbatim.</li>
                        <li><strong>AI reorders:</strong> bullet points don't follow document order.</li>
                        <li><strong>PDF text extraction is lossy:</strong> word positions get lost when extracting plain text.</li>
                      </ul>
                    </div>
                    <div className="space-y-4">
                      <h3 className="text-2xl font-bold text-[var(--text-primary)]">The Solution</h3>
                      <p className="text-[var(--text-secondary)] leading-relaxed text-lg">
                        The key insight is to extract <strong>two representations from one pass</strong>. The Anchor Text acts as the single source of truth. Both the markdown sent to the AI and the spatial tracking index used by the frontend share the exact same character offsets.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Architecture Diagram */}
                <div className="max-w-3xl mx-auto my-16 p-8 md:p-16 border border-[var(--border-color)] rounded-3xl bg-[#09090b] shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[var(--border-active)] to-transparent opacity-50"></div>
                  <div className="flex flex-col items-center relative z-10">
                    <div className="px-6 py-3 bg-[#18181b] rounded-xl font-mono text-sm border border-[var(--border-color)] text-[var(--text-primary)] shadow-md">PDF Document</div>
                    <div className="h-10 w-px bg-gradient-to-b from-[var(--border-color)] to-[var(--border-active)] my-1"></div>
                    <div className="px-8 py-5 bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-active)] shadow-[0_0_30px_rgba(255,255,255,0.05)] text-center relative">
                      <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl blur opacity-20 -z-10"></div>
                      <div className="font-semibold text-[var(--text-primary)] text-lg mb-1">Python Extractor</div>
                      <div className="text-xs text-[var(--text-muted)] font-mono">PyMuPDF4LLM + fitz</div>
                    </div>
                    <div className="h-10 w-px bg-[var(--border-active)] my-1 relative">
                      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-full max-w-[280px] h-px bg-[var(--border-active)]"></div>
                    </div>
                    <div className="flex gap-12 sm:gap-32 mt-4">
                      <div className="flex flex-col items-center">
                        <div className="h-8 w-px bg-[var(--border-active)] mb-1"></div>
                        <div className="px-6 py-4 bg-[#18181b] rounded-xl font-mono text-sm border border-[var(--border-color)] border-t-2 border-t-[#ff5f56] text-center shadow-lg">
                          <div className="text-[var(--text-primary)] mb-1">fullText</div>
                          <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">For the AI</div>
                        </div>
                      </div>
                      <div className="flex flex-col items-center">
                        <div className="h-8 w-px bg-[var(--border-active)] mb-1"></div>
                        <div className="px-6 py-4 bg-[#18181b] rounded-xl font-mono text-sm border border-[var(--border-color)] border-t-2 border-t-[#27c93f] text-center shadow-lg">
                          <div className="text-[var(--text-primary)] mb-1">Position Index</div>
                          <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">For the Resolver</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Phase 1 & 2 */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
                  <div className="space-y-6">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[var(--border-color)] bg-[var(--bg-primary)] text-xs font-semibold text-[var(--text-primary)]">
                      Phase 1
                    </div>
                    <h3 className="text-3xl font-bold text-[var(--text-primary)]">Extraction & Anchor Text</h3>
                    <p className="text-[var(--text-secondary)] leading-relaxed text-lg">
                      The Python extractor uses PyMuPDF4LLM for a single-pass extraction. For each page, it builds the <strong>Anchor Text</strong> — a deterministic concatenation of all words in reading order.
                    </p>
                    <CodeSnippet 
                      title="pdf_extractor.py"
                      code={`def build_anchor_data(words, page_height):
    # Sort words (deterministic reading order)
    parsed_words.sort(key=lambda w: (block, line, word, y, x))
    
    # Concatenate to form a single source of truth
    for word in parsed_words:
        spans.append({
            "text": token,
            "x": x0,
            "y": page_height - y1, # Flip Y for web
            "char_offset": char_offset,
        })
    return anchor_text, spans`}
                    />
                  </div>
                  
                  <div className="space-y-6 mt-8 lg:mt-32">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[var(--border-color)] bg-[var(--bg-primary)] text-xs font-semibold text-[var(--text-primary)]">
                      Phase 2
                    </div>
                    <h3 className="text-3xl font-bold text-[var(--text-primary)]">AI Context & Structured JSON</h3>
                    <p className="text-[var(--text-secondary)] leading-relaxed text-lg">
                      We pass the Anchor Text into the LLM context. To prevent hallucinations and paraphrasing, we enforce <strong>Structured Object Output</strong>. The AI must return its conversational `answer`, and an array of `quotes`.
                    </p>
                    <CodeSnippet 
                      title="AI Pipeline"
                      code={`const response = await llm.chat({
  messages: [{ role: "user", content: prompt }],
  response_format: {
    type: "json_schema",
    json_schema: {
      name: "document_answer",
      schema: {
        type: "object",
        properties: {
          answer: { type: "string" },
          quotes: { type: "array", items: { type: "string" } }
        },
        required: ["answer", "quotes"]
      }
    }
  }
});`}
                    />
                    
                    <div className="p-5 rounded-xl border border-[#ff5f56]/20 bg-[#ff5f56]/5 shadow-sm mt-6">
                      <h4 className="font-bold text-[var(--text-primary)] text-sm mb-2 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#ff5f56]"></span>
                        Critical: Verbatim Quotes Required
                      </h4>
                      <p className="text-[var(--text-secondary)] text-sm leading-relaxed">
                        The <code className="text-xs bg-[var(--bg-primary)] px-1 py-0.5 rounded border border-[var(--border-color)]">quotes</code> array must contain <strong>exact, character-for-character copies</strong> from the document — not paraphrased summaries. Your system prompt should instruct the AI: <em>"Copy quotes verbatim from the document text. Do not paraphrase or modify them."</em>
                      </p>
                    </div>
                    
                    <div className="p-5 rounded-xl border border-[#27c93f]/20 bg-[#27c93f]/5 shadow-sm mt-4">
                      <h4 className="font-bold text-[var(--text-primary)] text-sm mb-2 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#27c93f]"></span>
                        Page Markers: [PAGE_X]
                      </h4>
                      <p className="text-[var(--text-secondary)] text-sm leading-relaxed">
                        The <code className="text-xs bg-[var(--bg-primary)] px-1 py-0.5 rounded border border-[var(--border-color)]">fullText</code> includes <code className="text-xs bg-[var(--bg-primary)] px-1 py-0.5 rounded border border-[var(--border-color)]">[PAGE_1]</code>, <code className="text-xs bg-[var(--bg-primary)] px-1 py-0.5 rounded border border-[var(--border-color)]">[PAGE_2]</code>, etc. markers. When the AI references these in its answer, you can parse the page number and pass it as <code className="text-xs bg-[var(--bg-primary)] px-1 py-0.5 rounded border border-[var(--border-color)]">estimatedPage</code> to the resolver — this speeds up matching and eliminates false positives from similar text on other pages.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Phase 3 & 4 */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start border-t border-[var(--border-color)] pt-16">
                  <div className="space-y-6">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[var(--border-color)] bg-[var(--bg-primary)] text-xs font-semibold text-[var(--text-primary)]">
                      Phase 3
                    </div>
                    <h3 className="text-3xl font-bold text-[var(--text-primary)]">Highlight Resolution Engine</h3>
                    <p className="text-[var(--text-secondary)] leading-relaxed text-lg mb-6">
                      Instead of relying on unstable LLM coordinates, we map verbatim quotes back to PDF coordinates using a deterministic <strong>Multi-Tier Matcher</strong>.
                    </p>
                    
                    <div className="p-5 rounded-xl border border-[#ffbd2e]/20 bg-[#ffbd2e]/5 shadow-sm mb-6">
                      <h4 className="font-bold text-[var(--text-primary)] text-sm mb-2 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#ffbd2e]"></span>
                        Page-Priority Optimization
                      </h4>
                      <p className="text-[var(--text-secondary)] text-sm leading-relaxed">
                        To eliminate false positives across identical clauses in large documents, the resolver first sorts pages by proximity to the <code className="text-xs bg-[var(--bg-primary)] px-1 py-0.5 rounded border border-[var(--border-color)]">estimatedPage</code> (derived from model citations) before evaluating matching tiers.
                      </p>
                    </div>

                    <ul className="space-y-6 text-[var(--text-secondary)]">
                      <li className="flex gap-4">
                        <span className="w-8 h-8 shrink-0 rounded-full bg-[var(--bg-primary)] flex items-center justify-center border border-[var(--border-color)] font-mono text-[var(--text-primary)] mt-1">1</span>
                        <div>
                          <p className="font-bold text-[var(--text-primary)] text-lg">Exact Substring Match</p>
                          <p className="mt-1 leading-relaxed text-sm">The fastest path. A simple <span className="font-mono text-xs bg-[var(--bg-primary)] px-1 rounded border border-[var(--border-color)]">.indexOf()</span> finds perfect LLM quotes securely.</p>
                        </div>
                      </li>
                      <li className="flex gap-4">
                        <span className="w-8 h-8 shrink-0 rounded-full bg-[var(--bg-primary)] flex items-center justify-center border border-[var(--border-color)] font-mono text-[var(--text-primary)] mt-1">2</span>
                        <div>
                          <p className="font-bold text-[var(--text-primary)] text-lg">Case-Insensitive Match</p>
                          <p className="mt-1 leading-relaxed text-sm">Accounts for minor LLM capitalization adjustments.</p>
                        </div>
                      </li>
                      <li className="flex gap-4">
                        <span className="w-8 h-8 shrink-0 rounded-full bg-[var(--bg-primary)] flex items-center justify-center border border-[var(--border-color)] font-mono text-[var(--text-primary)] mt-1 text-xs">2.5</span>
                        <div>
                          <p className="font-bold text-[var(--text-primary)] text-lg">Punctuation-Agnostic Match</p>
                          <p className="mt-1 leading-relaxed text-sm">Strips spaces and punctuation (<span className="font-mono text-xs text-[#27c93f]">/[\\s\\p&#123;P&#125;]+/gu</span>) to align quotes even when paragraph boundaries differ.</p>
                        </div>
                      </li>
                      <li className="flex gap-4">
                        <span className="w-8 h-8 shrink-0 rounded-full bg-[var(--bg-primary)] flex items-center justify-center border border-[var(--border-color)] font-mono text-[var(--text-primary)] mt-1">3</span>
                        <div>
                          <p className="font-bold text-[var(--text-primary)] text-lg">Word-Level Sliding Window</p>
                          <p className="mt-1 leading-relaxed text-sm">Tokenizes both texts into words and slides a dynamic window across the page. Handing AI paraphrasing by evaluating: <code className="text-xs text-[#ff5f56]">matchCount / searchWords.length &gt;= 0.6</code></p>
                        </div>
                      </li>
                    </ul>
                  </div>
                  
                  <div className="space-y-6 lg:mt-24">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[var(--border-color)] bg-[var(--bg-primary)] text-xs font-semibold text-[var(--text-primary)]">
                      Phase 4
                    </div>
                    <h3 className="text-3xl font-bold text-[var(--text-primary)]">Visual Highlighting</h3>
                    <p className="text-[var(--text-secondary)] leading-relaxed text-lg">
                      Once resolved to a <span className="font-mono text-sm bg-[var(--bg-primary)] px-1 rounded border border-[var(--border-color)]">charStart</span> / <span className="font-mono text-sm bg-[var(--bg-primary)] px-1 rounded border border-[var(--border-color)]">charEnd</span>, we iterate over the Position Index to extract the exact bounding box spans to render above the PDF viewer.
                    </p>
                    <CodeSnippet 
                      title="visual_highlights.ts"
                      code={`const highlight = resolveHighlight(index, aiQuote);
const spans = getSpansForHighlight(index, highlight);

// Result:
// [
//   { x: 150.2, y: 400.1, width: 42.5, height: 11.0 },
//   { x: 195.0, y: 400.1, width: 24.3, height: 11.0 },
// ]

for (const span of spans) {
  // Translate to viewer coordinates and render
  drawHighlight(span.x, pageHeight - span.y, span.w, span.h);
}`}
                    />
                  </div>
                </div>

                {/* Comparison Table */}
                <div className="pt-16 border-t border-[var(--border-color)]">
                    <h3 className="text-2xl font-bold text-[var(--text-primary)] mb-8 text-center">Why This Architecture?</h3>
                    <div className="bg-[var(--bg-primary)] rounded-2xl border border-[var(--border-color)] overflow-hidden shadow-xl">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-[#18181b] border-b border-[var(--border-color)] text-[var(--text-primary)]">
                              <th className="p-4 font-semibold w-1/3">Approach</th>
                              <th className="p-4 font-semibold w-1/4">Accuracy</th>
                              <th className="p-4 font-semibold w-1/4">Speed</th>
                              <th className="p-4 font-semibold text-center">LLM Calls</th>
                            </tr>
                          </thead>
                          <tbody className="text-[var(--text-secondary)]">
                            <tr className="border-b border-[var(--border-color)]">
                              <td className="p-4 bg-[var(--bg-secondary)] font-medium">Search PDF for AI text</td>
                              <td className="p-4">Low (paraphrasing breaks it)</td>
                              <td className="p-4">Fast</td>
                              <td className="p-4 text-center font-mono bg-[var(--bg-secondary)]">0</td>
                            </tr>
                            <tr className="border-b border-[var(--border-color)]">
                              <td className="p-4 bg-[var(--bg-secondary)] font-medium">Ask LLM to return page/lines</td>
                              <td className="p-4">Medium (hallucination risk)</td>
                              <td className="p-4">Slow</td>
                              <td className="p-4 text-center font-mono bg-[var(--bg-secondary)]">2x</td>
                            </tr>
                            <tr className="bg-[var(--bg-primary)] relative">
                              <td className="p-4 font-bold text-[var(--text-primary)]">
                                DocAI Engine <span className="absolute left-0 top-0 bottom-0 w-1 bg-[#27c93f]"></span>
                              </td>
                              <td className="p-4 font-medium text-[#27c93f]">High (3-tier fuzzy matching)</td>
                              <td className="p-4 font-medium text-[#27c93f]">Fast</td>
                              <td className="p-4 text-center font-mono font-bold text-[var(--text-primary)]">1x</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                </div>

                {/* Quick Start for Developers */}
                <div className="pt-16 border-t border-[var(--border-color)]">
                  <div className="text-center space-y-4 mb-12">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[var(--border-active)] bg-[var(--bg-primary)] text-xs font-semibold text-[var(--text-primary)]">
                      For Developers
                    </div>
                    <h3 className="text-3xl font-bold text-[var(--text-primary)]">Quick Start</h3>
                    <p className="text-[var(--text-secondary)] max-w-2xl mx-auto">Use the <code className="text-sm bg-[var(--bg-primary)] px-2 py-0.5 rounded border border-[var(--border-color)]">@docai/pdf</code> library in your own projects.</p>
                  </div>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <h4 className="font-bold text-[var(--text-primary)] flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-[var(--bg-primary)] flex items-center justify-center border border-[var(--border-color)] text-xs">1</span>
                        Installation
                      </h4>
                      <CodeSnippet 
                        title="Terminal"
                        code={`# Install the package
npm install @docai/pdf

# Python dependencies (for PDF extraction)
cd node_modules/@docai/pdf/python
python3 -m venv venv
source venv/bin/activate
pip install pymupdf pymupdf4llm`}
                      />
                    </div>
                    
                    <div className="space-y-4">
                      <h4 className="font-bold text-[var(--text-primary)] flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-[var(--bg-primary)] flex items-center justify-center border border-[var(--border-color)] text-xs">2</span>
                        Basic Usage
                      </h4>
                      <CodeSnippet 
                        title="your-app.ts"
                        code={`import {
  extractAndIndex,
  resolveHighlight,
  getSpansForHighlight,
} from '@docai/pdf';

// 1. Extract PDF → position index
const index = await extractAndIndex('doc.pdf');

// 2. Send to your LLM (use structured output!)
const { answer, quotes } = await yourLLM(index.fullText);

// 3. Resolve quotes → PDF coordinates
for (const quote of quotes) {
  const hl = resolveHighlight(index, quote);
  const spans = getSpansForHighlight(index, hl);
  // Draw spans on your PDF viewer
}`}
                      />
                    </div>
                  </div>
                </div>

                {/* Limitations */}
                <div className="pt-16 border-t border-[var(--border-color)]">
                  <h3 className="text-2xl font-bold text-[var(--text-primary)] mb-8 text-center">Limitations & Edge Cases</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="p-6 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)]">
                      <div className="w-10 h-10 rounded-lg bg-[#ff5f56]/10 flex items-center justify-center mb-4">
                        <span className="text-[#ff5f56] text-lg">3+</span>
                      </div>
                      <h4 className="font-bold text-[var(--text-primary)] mb-2">Minimum Quote Length</h4>
                      <p className="text-[var(--text-secondary)] text-sm leading-relaxed">Quotes shorter than 3 characters are ignored to avoid false positives. Single words or short IDs may need more context.</p>
                    </div>
                    
                    <div className="p-6 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)]">
                      <div className="w-10 h-10 rounded-lg bg-[#ffbd2e]/10 flex items-center justify-center mb-4">
                        <FileText className="w-5 h-5 text-[#ffbd2e]" />
                      </div>
                      <h4 className="font-bold text-[var(--text-primary)] mb-2">Scanned PDFs</h4>
                      <p className="text-[var(--text-secondary)] text-sm leading-relaxed">Scanned documents require OCR preprocessing. The extractor works on text-based PDFs; image-only pages return empty text.</p>
                    </div>
                    
                    <div className="p-6 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)]">
                      <div className="w-10 h-10 rounded-lg bg-[#27c93f]/10 flex items-center justify-center mb-4">
                        <MousePointerClick className="w-5 h-5 text-[#27c93f]" />
                      </div>
                      <h4 className="font-bold text-[var(--text-primary)] mb-2">Complex Tables</h4>
                      <p className="text-[var(--text-secondary)] text-sm leading-relaxed">Tables with merged cells or complex layouts may have jumbled text order. Simple tables work well.</p>
                    </div>
                    
                    <div className="p-6 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)]">
                      <div className="w-10 h-10 rounded-lg bg-[var(--text-muted)]/10 flex items-center justify-center mb-4">
                        <span className="text-[var(--text-muted)] text-lg">📷</span>
                      </div>
                      <h4 className="font-bold text-[var(--text-primary)] mb-2">Images & Diagrams</h4>
                      <p className="text-[var(--text-secondary)] text-sm leading-relaxed">Visual content (charts, diagrams, images) cannot be extracted or highlighted. Only text content is supported.</p>
                    </div>
                    
                    <div className="p-6 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)]">
                      <div className="w-10 h-10 rounded-lg bg-[var(--text-muted)]/10 flex items-center justify-center mb-4">
                        <span className="text-[var(--text-muted)] text-lg">60%</span>
                      </div>
                      <h4 className="font-bold text-[var(--text-primary)] mb-2">Fuzzy Match Threshold</h4>
                      <p className="text-[var(--text-secondary)] text-sm leading-relaxed">The word-level matcher requires 60% of words to match. Heavily paraphrased quotes may not resolve correctly.</p>
                    </div>
                    
                    <div className="p-6 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)]">
                      <div className="w-10 h-10 rounded-lg bg-[var(--text-muted)]/10 flex items-center justify-center mb-4">
                        <MessageSquareQuote className="w-5 h-5 text-[var(--text-muted)]" />
                      </div>
                      <h4 className="font-bold text-[var(--text-primary)] mb-2">AI Paraphrasing</h4>
                      <p className="text-[var(--text-secondary)] text-sm leading-relaxed">If the AI rewrites quotes instead of copying verbatim, resolution may fail. Use strong system prompts to enforce exact copying.</p>
                    </div>
                  </div>
                </div>

              </div>
              </div>
            </div>
          )}
        </div>
      </AuthGate>
  );
}

// Custom component for beautiful Code Snippets
function CodeSnippet({ code, title }: { code: string; title?: string }) {
  return (
    <div className="rounded-xl overflow-hidden border border-[var(--border-color)] shadow-2xl bg-[#09090b]">
      <div className="flex items-center px-4 py-3 border-b border-[var(--border-color)] bg-[#12121a]">
        <div className="flex gap-2 w-16">
          <div className="w-3 h-3 rounded-full bg-[#ff5f56]"></div>
          <div className="w-3 h-3 rounded-full bg-[#ffbd2e]"></div>
          <div className="w-3 h-3 rounded-full bg-[#27c93f]"></div>
        </div>
        <div className="flex-1 text-center font-mono text-xs text-[var(--text-muted)] truncate">
          {title}
        </div>
        <div className="w-16"></div>
      </div>
      <div className="p-5 overflow-x-auto">
        <pre className="font-mono text-xs md:text-sm leading-loose text-emerald-300">
          <code>
{code.split('\\n').map((line, i) => (
  <div key={i} className="table-row">
    <span className="table-cell pr-6 text-[var(--text-muted)] select-none text-right opacity-50">{i + 1}</span>
    <span className="table-cell whitespace-pre">{line || " "}</span>
  </div>
))}
          </code>
        </pre>
      </div>
    </div>
  );
}
