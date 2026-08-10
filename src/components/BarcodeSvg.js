import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

const BarcodeSvg = ({ 
  value, 
  width = 1.3, 
  height = 36, 
  fontSize = 0, 
  displayValue = false,
  className = ''
}) => {
  const svgRef = useRef(null);

  useEffect(() => {
    if (svgRef.current && value) {
      try {
        JsBarcode(svgRef.current, value.toString().trim(), {
          format: 'CODE128',
          width: width,
          height: height,
          displayValue: displayValue,
          fontSize: fontSize,
          margin: 0,
          background: 'transparent',
          lineColor: '#000000',
          valid: function (valid) {
            if (!valid) {
              console.warn('Invalid barcode value:', value);
            }
          }
        });
      } catch (err) {
        console.warn('Barcode render error for:', value, err);
      }
    }
  }, [value, width, height, fontSize, displayValue]);

  if (!value) return null;

  return (
    <svg 
      ref={svgRef} 
      className={className}
      style={{ 
        maxWidth: '100%', 
        height: `${height}px`, 
        display: 'block',
        margin: '0 auto' 
      }} 
    />
  );
};

export default React.memo(BarcodeSvg);
