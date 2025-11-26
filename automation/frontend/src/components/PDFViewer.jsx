import { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

function PDFViewer({ fileUrl, title }) {
    const [numPages, setNumPages] = useState(null);
    const [pageNumber, setPageNumber] = useState(1);
    const [scale, setScale] = useState(1.0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    function onDocumentLoadSuccess({ numPages }) {
        setNumPages(numPages);
        setLoading(false);
    }

    function onDocumentLoadError(error) {
        console.error('Error loading PDF:', error);
        setError('Failed to load PDF document');
        setLoading(false);
    }

    const changePage = (offset) => {
        setPageNumber(prevPageNumber => prevPageNumber + offset);
    };

    const previousPage = () => changePage(-1);
    const nextPage = () => changePage(1);
    const zoomIn = () => setScale(prev => Math.min(prev + 0.2, 2.0));
    const zoomOut = () => setScale(prev => Math.max(prev - 0.2, 0.5));

    if (error) {
        return (
            <div className="pdf-error">
                <p>❌ {error}</p>
            </div>
        );
    }

    return (
        <div className="pdf-viewer">
            <div className="pdf-header">
                <h4>{title}</h4>
                <div className="pdf-controls">
                    <button onClick={zoomOut} className="btn-icon" disabled={scale <= 0.5}>
                        🔍−
                    </button>
                    <span className="zoom-level">{Math.round(scale * 100)}%</span>
                    <button onClick={zoomIn} className="btn-icon" disabled={scale >= 2.0}>
                        🔍+
                    </button>
                    <div className="page-nav">
                        <button
                            onClick={previousPage}
                            disabled={pageNumber <= 1}
                            className="btn-icon"
                        >
                            ◀
                        </button>
                        <span className="page-info">
                            Page {pageNumber} of {numPages || '?'}
                        </span>
                        <button
                            onClick={nextPage}
                            disabled={pageNumber >= numPages}
                            className="btn-icon"
                        >
                            ▶
                        </button>
                    </div>
                    <a
                        href={fileUrl}
                        download
                        className="btn-download"
                        title="Download PDF"
                    >
                        📥 Download
                    </a>
                </div>
            </div>

            <div className="pdf-container">
                {loading && (
                    <div className="pdf-loading">
                        <div className="spinner"></div>
                        <p>Loading PDF...</p>
                    </div>
                )}
                <Document
                    file={fileUrl}
                    onLoadSuccess={onDocumentLoadSuccess}
                    onLoadError={onDocumentLoadError}
                    loading=""
                >
                    <Page
                        pageNumber={pageNumber}
                        scale={scale}
                        renderTextLayer={true}
                        renderAnnotationLayer={true}
                    />
                </Document>
            </div>
        </div>
    );
}

export default PDFViewer;
