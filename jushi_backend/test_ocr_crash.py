import sys
sys.path.append(".")
from app.services.rag_service import OcrFallbackPDFReader
from pathlib import Path

reader = OcrFallbackPDFReader()
pdf_path = Path("app/data/documents/串.pdf")

try:
    print(f"Loading {pdf_path}")
    docs = reader.load_data(file_path=pdf_path)
    print(f"Loaded {len(docs)} docs")
    if docs:
        print(f"First 100 chars: {docs[0].text[:100]}")
except Exception as e:
    import traceback
    traceback.print_exc()
