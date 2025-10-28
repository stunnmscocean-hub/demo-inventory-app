import React from 'react';
import styles from './PdfViewer.module.css';

const PdfViewer = ({ pdfUrl, onImagesGenerated }) => {
  return (
    <div className={styles.pdfViewer}>
      <div className={styles.pdfHeader}>
        <h3>PDF 미리보기</h3>
      </div>
      
      <div className={styles.pdfContainer}>
        <div className={styles.pdfInfo}>
          <p>PDF 파일이 생성되었습니다.</p>
          <p>JPG 이미지로 미리보기를 확인하세요.</p>
        </div>
      </div>

      <div className={styles.pdfActions}>
        <button
          onClick={() => window.open(pdfUrl, '_blank')}
          className={styles.downloadButton}
        >
          PDF 다운로드
        </button>
      </div>
    </div>
  );
};

export default PdfViewer;