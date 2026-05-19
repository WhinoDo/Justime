import logging
import sys
sys.path.append(".")
from app.services.rag_service import OcrFallbackPDFReader
from pathlib import Path

logger = logging.getLogger(__name__)

reader = OcrFallbackPDFReader()
pdf_path = Path("app/data/documents/串.pdf")

try:
    logger.info("Loading %s", pdf_path)
    docs = reader.load_data(file_path=pdf_path)
    logger.info("Loaded %d docs", len(docs))
    if docs:
        logger.info("First 100 chars: %s", docs[0].text[:100])
except Exception as e:
    import traceback
    traceback.print_exc()
