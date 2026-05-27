import logging

import fitz

logger = logging.getLogger(__name__)

if __name__ == "__main__":
    doc = fitz.open("app/data/documents/串.pdf")
    for i in range(min(3, len(doc))):
        page = doc[i]
        images = page.get_images(full=True)
        logger.info("Page %d has %d images", i, len(images))
        text = page.get_text()
        logger.info("Page %d text length: %d", i, len(text))
