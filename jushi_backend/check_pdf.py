import fitz

if __name__ == "__main__":
    doc = fitz.open("app/data/documents/串.pdf")
    for i in range(min(3, len(doc))):
        page = doc[i]
        images = page.get_images(full=True)
        print(f"Page {i} has {len(images)} images")
        text = page.get_text()
        print(f"Page {i} text length: {len(text)}")
