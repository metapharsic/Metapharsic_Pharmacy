"""
Deterministic Zero-LLM Multi-Document OCR Engine
Metapharsic Rx - PharmaCare Enterprise

Supports 3 Document Classes:
1. invoice: Bilateral Filter + CLAHE + PaddleOCR bounding polygons for coordinate table reconstruction
2. receipt: CLAHE + Gaussian Adaptive Thresholding for faded/wrinkled single-column thermal slips
3. prescription: Contrast Equalization + Sauvola/Otsu binarization for printed & cursive doctor Rx
"""

import os
import sys
import io
import warnings
import json
import argparse
import numpy as np

# Suppress noisy warnings
warnings.filterwarnings('ignore')
os.environ['PYTHONWARNINGS'] = 'ignore'
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
os.environ['PADDLE_DISABLE_STATIC_MODEL'] = '1'
os.environ['PADDLE_DISABLE_MKLDNN'] = '1'

# UTF-8 stdout
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

import cv2
import fitz  # PyMuPDF

# Try importing PaddleOCR
_has_paddle = False
PaddleOCR = None
try:
    import paddle.inference as p_inf
    orig_create_predictor = p_inf.create_predictor
    def patched_create_predictor(config):
        if hasattr(config, 'disable_onednn'):
            config.disable_onednn()
        if hasattr(config, 'disable_mkldnn'):
            config.disable_mkldnn()
        return orig_create_predictor(config)
    p_inf.create_predictor = patched_create_predictor

    from paddleocr import PaddleOCR
    _has_paddle = True
except Exception:
    _has_paddle = False

_cached_ocr = None
def get_ocr_instance():
    global _cached_ocr
    if _cached_ocr is None and _has_paddle:
        try:
            _cached_ocr = PaddleOCR(
                use_doc_orientation_classify=False,
                use_doc_unwarping=False,
                use_textline_orientation=False,
                lang='en'
            )
        except Exception:
            _cached_ocr = None
    return _cached_ocr


def preprocess_image(img_bgr, mode='invoice'):
    """Applies document-specific computer vision filter pipelines."""
    if img_bgr is None:
        raise ValueError("Invalid image provided")

    h, w = img_bgr.shape[:2]
    # Scale if exceeding 2000px on max dimension to ensure fast sub-second CPU inference
    max_dim = 1600 if mode == 'invoice' else 1200
    if max(h, w) > max_dim:
        scale = float(max_dim) / max(h, w)
        img_bgr = cv2.resize(img_bgr, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)

    if len(img_bgr.shape) == 2:
        gray = img_bgr
    else:
        gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)

    if mode == 'receipt':
        # Pipeline 2: Thermal receipts (wrinkled paper + faded ink + heat spots)
        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
        contrast = clahe.apply(gray)
        # Adaptive Gaussian thresholding isolates text from uneven thermal backgrounds
        binary = cv2.adaptiveThreshold(
            contrast, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 17, 9
        )
        return cv2.cvtColor(binary, cv2.COLOR_GRAY2BGR)

    elif mode == 'prescription':
        # Pipeline 3: Prescriptions (ballpoint blue/black ink + clinic letterheads)
        denoised = cv2.medianBlur(gray, 3)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        contrast = clahe.apply(denoised)
        # Otsu thresholding with slight blur preserves cursive stroke continuity
        _, binary = cv2.threshold(contrast, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        return cv2.cvtColor(binary, cv2.COLOR_GRAY2BGR)

    else:
        # Pipeline 1: Invoices (clean / dot-matrix tables)
        # Bilateral filter removes paper print noise while keeping high edge sharpness
        denoised = cv2.bilateralFilter(gray, 9, 75, 75)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        enhanced = clahe.apply(denoised)
        return cv2.cvtColor(enhanced, cv2.COLOR_GRAY2BGR)


def extract_boxes_from_image(img_bgr, mode='invoice', page_idx=0):
    """Processes an image through OpenCV and extracts spatial text boxes."""
    h_orig, w_orig = img_bgr.shape[:2]
    preprocessed = preprocess_image(img_bgr, mode)
    h_proc, w_proc = preprocessed.shape[:2]
    scale_x = float(w_orig) / w_proc
    scale_y = float(h_orig) / h_proc

    boxes = []
    ocr = get_ocr_instance()

    if ocr is not None:
        try:
            results = list(ocr.predict(preprocessed))
            if results and len(results) > 0:
                first = results[0]
                if hasattr(first, '__getitem__') and 'rec_texts' in first:
                    rec_texts = first['rec_texts']
                    rec_scores = first.get('rec_scores', [1.0] * len(rec_texts))
                    rec_boxes = first.get('rec_boxes', [])
                    for i, text in enumerate(rec_texts):
                        t = text.strip()
                        if not t:
                            continue
                        score = float(rec_scores[i]) if i < len(rec_scores) else 0.95
                        b = rec_boxes[i] if i < len(rec_boxes) else [0, 0, 0, 0]
                        # Scale back to original coordinates
                        x1 = float(b[0]) * scale_x
                        y1 = float(b[1]) * scale_y
                        x2 = float(b[2]) * scale_x
                        y2 = float(b[3]) * scale_y
                        boxes.append({
                            "text": t,
                            "confidence": round(score, 3),
                            "box": [round(x1, 1), round(y1, 1), round(x2, 1), round(y2, 1)],
                            "page": page_idx + 1
                        })
                elif isinstance(first, list):
                    for item in first:
                        if len(item) >= 2 and isinstance(item[1], (tuple, list)):
                            t = str(item[1][0]).strip()
                            if not t:
                                continue
                            conf = float(item[1][1])
                            poly = item[0]
                            xs = [p[0] * scale_x for p in poly]
                            ys = [p[1] * scale_y for p in poly]
                            boxes.append({
                                "text": t,
                                "confidence": round(conf, 3),
                                "box": [round(min(xs), 1), round(min(ys), 1), round(max(xs), 1), round(max(ys), 1)],
                                "page": page_idx + 1
                            })
        except Exception:
            pass

    return {
        "page": page_idx + 1,
        "width": w_orig,
        "height": h_orig,
        "boxes": boxes
    }


def main():
    parser = argparse.ArgumentParser(description="Deterministic Zero-LLM OCR Engine")
    parser.add_argument("--input", required=True, help="Path to document file (Image or PDF)")
    parser.add_argument("--mode", default="invoice", choices=["invoice", "receipt", "prescription"], help="Document mode")
    args = parser.parse_args()

    file_path = os.path.abspath(args.input)
    if not os.path.exists(file_path):
        print(json.dumps({"success": False, "error": f"File not found: {file_path}"}))
        sys.exit(1)

    ext = os.path.splitext(file_path)[1].lower()
    pages_result = []

    try:
        if ext == '.pdf':
            doc = fitz.open(file_path)
            for page_idx in range(min(len(doc), 5)): # Max 5 pages for invoice batches
                page = doc[page_idx]
                pix = page.get_pixmap(dpi=150)
                img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
                if pix.n == 4:
                    img_bgr = cv2.cvtColor(img, cv2.COLOR_RGBA2BGR)
                else:
                    img_bgr = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)
                res = extract_boxes_from_image(img_bgr, args.mode, page_idx)
                pages_result.append(res)
        else:
            img_bgr = cv2.imread(file_path)
            if img_bgr is None:
                raise ValueError(f"OpenCV could not decode image: {file_path}")
            res = extract_boxes_from_image(img_bgr, args.mode, 0)
            pages_result.append(res)

        total_boxes = sum(len(p["boxes"]) for p in pages_result)
        out = {
            "success": True,
            "mode": args.mode,
            "pageCount": len(pages_result),
            "totalBoxes": total_boxes,
            "pages": pages_result
        }
        print(json.dumps(out))
    except Exception as e:
        print(json.dumps({
            "success": False,
            "mode": args.mode,
            "error": str(e)
        }))
        sys.exit(1)

if __name__ == "__main__":
    main()
