/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import mermaid from 'mermaid';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { 
  Download, 
  Copy, 
  Maximize2, 
  Minimize2, 
  Check,
  Palette,
  ZoomIn,
  ZoomOut,
  RefreshCw,
  FileCode2,
  AlertCircle,
  LayoutTemplate
} from 'lucide-react';

const TEMPLATES: Record<string, string> = {
  'Sequence': `sequenceDiagram
    actor User
    participant Client as Web Browser
    participant API as API Gateway
    participant Auth as Auth Service
    participant DB as Database

    User->>Client: Enter credentials
    Client->>API: POST /login
    API->>Auth: Validate credentials
    Auth->>DB: Query user
    DB-->>Auth: User data
    
    alt Invalid Credentials
        Auth-->>API: 401 Unauthorized
        API-->>Client: Error message
        Client-->>User: Show error
    else Valid Credentials
        Auth-->>API: JWT Token
        API-->>Client: 200 OK + Token
        Client-->>User: Redirect to Dashboard
    end`,
  'Flowchart': `graph TD
    A[Start] --> B{Is it raining?}
    B -- Yes --> C[Take umbrella]
    B -- No --> D[Enjoy the sun]
    C --> E[Go outside]
    D --> E`,
  'Gantt': `gantt
    title Project Plan
    dateFormat  YYYY-MM-DD
    section Planning
    Requirements :a1, 2023-01-01, 7d
    Design       :after a1, 10d
    section Development
    Frontend     :2023-01-18, 14d
    Backend      :2023-01-18, 14d
    section Testing
    QA           :2023-02-01, 7d`,
  'Class': `classDiagram
    Animal <|-- Duck
    Animal <|-- Fish
    Animal <|-- Zebra
    Animal : +int age
    Animal : +String gender
    Animal: +isMammal()
    Animal: +mate()
    class Duck{
      +String beakColor
      +swim()
      +quack()
    }
    class Fish{
      -int sizeInFeet
      -canEat()
    }
    class Zebra{
      +bool is_wild
      +run()
    }`,
  'State': `stateDiagram-v2
    [*] --> Idle
    Idle --> Processing : Start
    Processing --> Success : Complete
    Processing --> Error : Fail
    Error --> Idle : Retry
    Success --> [*]`,
  'Pie': `pie title Pets adopted by volunteers
    "Dogs" : 386
    "Cats" : 85
    "Rats" : 15
    "Birds" : 42`
};

const DEFAULT_CODE = TEMPLATES['Sequence'];

const THEMES = ['default', 'dark', 'forest', 'neutral', 'base'];

export default function App() {
  const [code, setCode] = useState(DEFAULT_CODE);
  const [debouncedCode, setDebouncedCode] = useState(DEFAULT_CODE);
  const [theme, setTheme] = useState('default');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [svgContent, setSvgContent] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [activeMobilePane, setActiveMobilePane] = useState<'editor' | 'preview'>('editor');
  const previewRef = useRef<HTMLDivElement>(null);

  // Debounce code changes to prevent excessive rendering
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedCode(code), 300);
    return () => clearTimeout(timer);
  }, [code]);

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: theme as any,
      securityLevel: 'loose',
      fontFamily: 'Inter, sans-serif',
    });
    renderDiagram();
  }, [debouncedCode, theme]);

  const renderDiagram = async () => {
    try {
      const id = `mermaid-preview-${Date.now()}`;
      const { svg } = await mermaid.render(id, debouncedCode);
      setSvgContent(svg);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Syntax error');
      // Mermaid might inject error SVG into DOM, try to clean it up
      const errorNodes = document.querySelectorAll('[id^="mermaid-preview-"]');
      errorNodes.forEach(node => node.remove());
    }
  };

  const exportImage = useCallback(async (format: 'png' | 'jpg' | 'svg' | 'code', copyToClipboard = false) => {
    if (format === 'code') {
      const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'diagram.mmd';
      link.click();
      return;
    }

    const svgElement = previewRef.current?.querySelector('svg');
    if (!svgElement) return;

    // Clone the SVG to avoid modifying the displayed one
    const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement;
    
    // Ensure xmlns is present
    if (!clonedSvg.getAttribute('xmlns')) {
      clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    }

    // Get actual dimensions
    const bbox = svgElement.getBoundingClientRect();
    const width = bbox.width;
    const height = bbox.height;
    
    clonedSvg.setAttribute('width', width.toString());
    clonedSvg.setAttribute('height', height.toString());

    const svgData = new XMLSerializer().serializeToString(clonedSvg);

    if (format === 'svg') {
      const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'diagram.svg';
      link.click();
      return;
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      const scale = 3; // Higher scale for better resolution
      canvas.width = width * scale;
      canvas.height = height * scale;
      
      if (ctx) {
        ctx.scale(scale, scale);
        
        // Fill background
        if (format === 'jpg' || theme === 'dark') {
          ctx.fillStyle = theme === 'dark' ? '#1e1e1e' : '#ffffff';
          ctx.fillRect(0, 0, width, height);
        } else {
          ctx.clearRect(0, 0, width, height);
        }
        
        ctx.drawImage(img, 0, 0, width, height);
      }
      
      URL.revokeObjectURL(url);

      if (copyToClipboard) {
        canvas.toBlob(blob => {
          if (blob) {
            navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }).catch(err => {
              console.error('Failed to copy image: ', err);
              alert('Failed to copy image to clipboard.');
            });
          }
        }, 'image/png');
      } else {
        const link = document.createElement('a');
        link.download = `diagram.${format}`;
        link.href = canvas.toDataURL(`image/${format === 'jpg' ? 'jpeg' : 'png'}`, 1.0);
        link.click();
      }
    };
    
    img.onerror = (err) => {
      console.error('Error loading SVG into image', err);
      URL.revokeObjectURL(url);
    };

    img.src = url;
  }, [code, theme]);

  return (
    <div className="flex h-[100dvh] w-full flex-col bg-gray-50 text-gray-900 font-sans overflow-hidden md:flex-row">
      {/* Left Panel: Editor */}
      <div 
        className={`flex-col border-b border-gray-200 transition-all duration-300 ease-in-out md:border-b-0 md:border-r ${
          isFullscreen
            ? 'hidden w-0 opacity-0 overflow-hidden md:flex'
            : activeMobilePane === 'editor'
              ? 'flex h-full w-full opacity-100 md:w-1/2'
              : 'hidden opacity-0 md:flex md:w-1/2 md:opacity-100'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-3 bg-white border-b border-gray-200 shrink-0 sm:px-4">
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <FileCode2 className="w-5 h-5 text-blue-600" />
            Mermaid Studio
          </h1>
          <div className="flex items-center gap-2">
            <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">Auto-rendering</div>
            <button
              type="button"
              onClick={() => setActiveMobilePane('preview')}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 md:hidden"
            >
              Preview
            </button>
          </div>
        </div>
        <div className="flex-1 relative bg-white">
          <Editor
            height="100%"
            defaultLanguage="markdown"
            value={code}
            onChange={(val) => setCode(val || '')}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              wordWrap: 'on',
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              padding: { top: 16, bottom: 16 },
              fontFamily: 'JetBrains Mono, monospace',
            }}
            theme={theme === 'dark' ? 'vs-dark' : 'vs-light'}
          />
        </div>
      </div>

      {/* Right Panel: Preview */}
      <div 
        className={`flex-col transition-all duration-300 ease-in-out ${
          isFullscreen
            ? 'flex h-full w-full'
            : activeMobilePane === 'preview'
              ? 'flex h-full w-full md:w-1/2'
              : 'hidden md:flex md:w-1/2'
        }`}
      >
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-3 border-b border-gray-200 bg-white shadow-sm z-10 shrink-0 sm:px-4">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1 border border-gray-200 hover:border-gray-300 transition-colors">
              <Palette className="w-4 h-4 text-gray-500 ml-2" />
              <select 
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                className="bg-transparent border-none text-sm font-medium text-gray-700 py-1 pr-8 focus:ring-0 cursor-pointer outline-none"
              >
                {THEMES.map(t => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1 border border-gray-200 hover:border-gray-300 transition-colors">
              <LayoutTemplate className="w-4 h-4 text-gray-500 ml-2" />
              <select 
                onChange={(e) => {
                  if (e.target.value) {
                    setCode(TEMPLATES[e.target.value]);
                  }
                }}
                className="bg-transparent border-none text-sm font-medium text-gray-700 py-1 pr-8 focus:ring-0 cursor-pointer outline-none"
                defaultValue=""
              >
                <option value="" disabled>Templates...</option>
                {Object.keys(TEMPLATES).map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setActiveMobilePane('editor')}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors shadow-sm md:hidden"
              title="Back to Editor"
            >
              <FileCode2 className="w-4 h-4" />
              <span>Editor</span>
            </button>

            <button 
              onClick={() => exportImage('png', true)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors shadow-sm"
              title="Copy Image to Clipboard"
            >
              {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              <span className="hidden sm:inline">{copied ? 'Copied!' : 'Copy'}</span>
            </button>

            <div className="relative group">
              <button className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm">
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Export</span>
              </button>
              <div className="absolute right-0 mt-2 w-40 bg-white border border-gray-200 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 transform origin-top-right scale-95 group-hover:scale-100">
                <div className="py-1">
                  <button onClick={() => exportImage('png')} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors">Download PNG</button>
                  <button onClick={() => exportImage('jpg')} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors">Download JPG</button>
                  <button onClick={() => exportImage('svg')} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors">Download SVG</button>
                  <div className="h-px bg-gray-200 my-1"></div>
                  <button onClick={() => exportImage('code')} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors">Download Code</button>
                </div>
              </div>
            </div>

            <div className="w-px h-6 bg-gray-300 mx-1"></div>

            <button 
              onClick={() => setIsFullscreen(!isFullscreen)}
              className={`p-2 rounded-lg transition-colors ${isFullscreen ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`}
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Preview Area */}
        <div className={`flex-1 relative overflow-hidden ${theme === 'dark' ? 'bg-[#1e1e1e]' : 'bg-gray-50/50'}`}>
          {/* Background Pattern */}
          <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
          
          {error ? (
            <div className="absolute inset-0 p-6 flex items-start justify-center overflow-auto z-10">
              <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-200 font-mono text-sm whitespace-pre-wrap w-full max-w-3xl shadow-sm flex items-start gap-3 mt-8">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold mb-1">Syntax Error</div>
                  {error}
                </div>
              </div>
            </div>
          ) : (
            <TransformWrapper
              key={`${svgContent}-${activeMobilePane}`}
              initialScale={1}
              minScale={0.1}
              maxScale={8}
              centerOnInit={true}
              wheel={{ step: 0.1 }}
            >
              {({ zoomIn, zoomOut, resetTransform }) => (
                <>
                  <div className="absolute bottom-4 right-4 z-20 flex flex-col gap-2 bg-white/90 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 p-1.5 sm:bottom-6 sm:right-6">
                    <button onClick={() => zoomIn()} className="p-2 hover:bg-gray-100 rounded-lg text-gray-700 transition-colors" title="Zoom In">
                      <ZoomIn className="w-4 h-4" />
                    </button>
                    <button onClick={() => zoomOut()} className="p-2 hover:bg-gray-100 rounded-lg text-gray-700 transition-colors" title="Zoom Out">
                      <ZoomOut className="w-4 h-4" />
                    </button>
                    <button onClick={() => resetTransform()} className="p-2 hover:bg-gray-100 rounded-lg text-gray-700 transition-colors" title="Reset Zoom">
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                  <TransformComponent wrapperClass="!w-full !h-full" contentClass="!w-full !h-full flex items-center justify-center">
                    <div 
                      ref={previewRef}
                      className="mermaid-svg-container cursor-grab active:cursor-grabbing p-4 sm:p-8 min-w-min min-h-min flex items-center justify-center transition-opacity duration-300"
                      dangerouslySetInnerHTML={{ __html: svgContent }}
                      onClick={() => {
                        if (!isFullscreen) setIsFullscreen(true);
                      }}
                      title={!isFullscreen ? "Click to view fullscreen" : ""}
                    />
                  </TransformComponent>
                </>
              )}
            </TransformWrapper>
          )}
        </div>
      </div>
    </div>
  );
}

