from llama_index.core import SimpleDirectoryReader
from llama_index.readers.file import PyMuPDFReader

if __name__ == "__main__":
    extractor = {".pdf": PyMuPDFReader()}
    docs = SimpleDirectoryReader(
        input_files=["app/data/documents/串.pdf"],
        file_extractor=extractor
    ).load_data()
    print("Loaded", len(docs), "documents")
    if len(docs) > 0:
        print("Metadata:", docs[0].metadata)
        print("Content sample:", docs[0].text[:100])
